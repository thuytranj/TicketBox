import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRedisKey(userId: string): string {
    return `refresh_token:${userId}`;
  }

  async register(registerDto: RegisterDto): Promise<Omit<User, 'passwordHash' | 'generateId'>> {
    const { email, password, fullName } = registerDto;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      email,
      passwordHash,
      fullName,
      role: UserRole.AUDIENCE,
    });

    const savedUser = await this.userRepository.save(user);

    const { passwordHash: _, ...result } = savedUser;
    return result;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; refreshToken: string }> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.generateTokens(user);
  }

  async refresh(refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string }> {
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

    const storedHash = await this.redisService.get(this.getRedisKey(userId));
    if (!storedHash) {
      throw new UnauthorizedException('Refresh token has been revoked or expired');
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

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
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
    await this.redisService.set(this.getRedisKey(user.id), hashedToken, 'EX', 604800);

    return {
      accessToken,
      refreshToken,
    };
  }
}
