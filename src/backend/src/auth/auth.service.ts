import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { RedisService } from '../common/redis/redis.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { generateOtp } from './utils/otp';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRedisKey(userId: string): string {
    return `refresh_token:${userId}`;
  }

  private getOtpKey(email: string): string {
    return `otp:${email}`;
  }

  private getOtpLimitKey(email: string): string {
    return `otp_limit:${email}`;
  }

  private getResetOtpKey(email: string): string {
    return `reset_otp:${email}`;
  }

  private getResetOtpLimitKey(email: string): string {
    return `reset_otp_limit:${email}`;
  }

  private getResetTokenKey(email: string): string {
    return `reset_token:${email}`;
  }

  async register(
    registerDto: RegisterDto,
  ): Promise<Omit<User, 'passwordHash' | 'generateId'>> {
    const { email, password, fullName } = registerDto;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hasLimit = await this.redisService.get(this.getOtpLimitKey(email));
    if (hasLimit) {
      throw new HttpException(
        'Please wait 60 seconds before requesting a new OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      role: UserRole.AUDIENCE,
      status: UserStatus.PENDING,
    });

    const savedUser = await this.userRepository.save(user);

    // Generate OTP
    const otp = generateOtp();

    // Store OTP in Redis (TTL 5 minutes = 300 seconds)
    await this.redisService.set(this.getOtpKey(email), otp, 'EX', 300);

    // Set OTP limit in Redis (TTL 60 seconds)
    await this.redisService.set(this.getOtpLimitKey(email), '1', 'EX', 60);

    // Publish to RabbitMQ
    try {
      await this.rabbitMQService.sendToQueue('notification.email.otp', {
        email,
        otp,
        type: 'verify',
      });
    } catch (err) {
      // Log error but do not fail the registration flow
      console.error('Failed to send OTP email task to RabbitMQ:', err);
    }

    const { passwordHash: _, ...result } = savedUser;
    return result;
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto): Promise<{ message: string }> {
    const { email, otp } = verifyOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      return { message: 'Account is already active' };
    }

    const storedOtp = await this.redisService.get(this.getOtpKey(email));
    if (!storedOtp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    if (storedOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Activate user
    user.status = UserStatus.ACTIVE;
    await this.userRepository.save(user);

    // Clean up Redis
    await this.redisService.del(this.getOtpKey(email));
    await this.redisService.del(this.getOtpLimitKey(email));

    return { message: 'Account activated successfully' };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Please verify your email address first');
    }

    return this.generateTokens(user);
  }

  async refresh(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken } = refreshTokenDto;

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload.userId;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Please verify your email address first');
    }

    const storedHash = await this.redisService.get(this.getRedisKey(userId));
    if (!storedHash) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired',
      );
    }

    const currentHash = this.hashToken(refreshToken);
    if (storedHash !== currentHash) {
      // Security: potential token reuse or hijacking. Revoke all.
      await this.redisService.del(this.getRedisKey(userId));
      throw new UnauthorizedException('Token reuse detected. Session revoked.');
    }

    return this.generateTokens(user);
  }

  async logout(refreshTokenDto: RefreshTokenDto): Promise<void> {
    const { refreshToken } = refreshTokenDto;

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.userId;
    const storedHash = await this.redisService.get(this.getRedisKey(userId));
    if (storedHash) {
      const currentHash = this.hashToken(refreshToken);
      if (storedHash === currentHash) {
        await this.redisService.del(this.getRedisKey(userId));
      } else {
        throw new UnauthorizedException('Invalid refresh token hash');
      }
    }
  }

  async resendOtp(resendOtpDto: ResendOtpDto): Promise<{ message: string }> {
    const { email } = resendOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      throw new BadRequestException('Account is already active');
    }

    const hasLimit = await this.redisService.get(this.getOtpLimitKey(email));
    if (hasLimit) {
      throw new HttpException(
        'Please wait 60 seconds before requesting a new OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = generateOtp();

    // Store OTP in Redis (TTL 5 minutes = 300 seconds)
    await this.redisService.set(this.getOtpKey(email), otp, 'EX', 300);

    // Set OTP limit in Redis (TTL 60 seconds)
    await this.redisService.set(this.getOtpLimitKey(email), '1', 'EX', 60);

    // Publish to RabbitMQ
    try {
      await this.rabbitMQService.sendToQueue('notification.email.otp', {
        email,
        otp,
        type: 'verify',
      });
    } catch (err) {
      console.error('Failed to send OTP email task to RabbitMQ:', err);
    }

    return { message: 'OTP resent successfully' };
  }

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Email not found or account is not active');
    }

    const hasLimit = await this.redisService.get(
      this.getResetOtpLimitKey(email),
    );
    if (hasLimit) {
      throw new HttpException(
        'Please wait 60 seconds before requesting a new reset OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = generateOtp();

    // Store reset OTP in Redis (TTL 5 minutes = 300 seconds)
    await this.redisService.set(this.getResetOtpKey(email), otp, 'EX', 300);

    // Set reset OTP limit in Redis (TTL 60 seconds)
    await this.redisService.set(this.getResetOtpLimitKey(email), '1', 'EX', 60);

    // Publish to RabbitMQ
    try {
      await this.rabbitMQService.sendToQueue('notification.email.otp', {
        email,
        otp,
        type: 'reset',
      });
    } catch (err) {
      console.error('Failed to send reset OTP email task to RabbitMQ:', err);
    }

    return { message: 'Reset password OTP sent successfully' };
  }

  async verifyResetOtp(
    verifyResetOtpDto: VerifyResetOtpDto,
  ): Promise<{ resetToken: string }> {
    const { email, otp } = verifyResetOtpDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new NotFoundException('Email not found or account is not active');
    }

    const storedOtp = await this.redisService.get(this.getResetOtpKey(email));
    if (!storedOtp) {
      throw new UnauthorizedException('OTP expired or invalid');
    }

    if (storedOtp !== otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const resetToken = randomBytes(16).toString('hex');
    await this.redisService.set(
      this.getResetTokenKey(email),
      resetToken,
      'EX',
      300,
    );

    // Clean up reset OTP
    await this.redisService.del(this.getResetOtpKey(email));

    return { resetToken };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { email, resetToken, newPassword } = resetPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const storedToken = await this.redisService.get(
      this.getResetTokenKey(email),
    );
    if (!storedToken) {
      throw new UnauthorizedException('Reset token expired or invalid');
    }

    if (storedToken !== resetToken) {
      throw new UnauthorizedException('Invalid reset token');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await this.userRepository.save(user);

    // Clean up reset token and rate limit from Redis
    await this.redisService.del(this.getResetTokenKey(email));
    await this.redisService.del(this.getResetOtpLimitKey(email));

    // Revoke all login sessions
    await this.redisService.del(this.getRedisKey(user.id));

    return { message: 'Password has been reset successfully' };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.sign(
      { userId: user.id, email: user.email, role: user.role },
      {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );

    const refreshToken = this.jwtService.sign(
      { userId: user.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    const hashedToken = this.hashToken(refreshToken);
    // 7 days in seconds = 7 * 24 * 60 * 60 = 604800
    await this.redisService.set(
      this.getRedisKey(user.id),
      hashedToken,
      'EX',
      604800,
    );

    return {
      accessToken,
      refreshToken,
    };
  }
}
