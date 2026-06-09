import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { RedisService } from '../common/redis/redis.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { ConflictException, UnauthorizedException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let redisService: RedisService;
  let rabbitMQService: RabbitMQService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      return null;
    }),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockRabbitMQService = {
    sendToQueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: RabbitMQService,
          useValue: mockRabbitMQService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a pending user successfully and push OTP email to RabbitMQ', async () => {
      const dto = { email: 'new@test.com', password: 'password', fullName: 'New User' };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockRedisService.get.mockResolvedValue(null); // No rate limit
      
      mockUserRepository.create.mockReturnValue({
        ...dto,
        id: 'uuid-7',
        role: UserRole.AUDIENCE,
        status: UserStatus.PENDING,
      });
      mockUserRepository.save.mockResolvedValue({
        id: 'uuid-7',
        email: dto.email,
        passwordHash: 'hashed-password',
        fullName: dto.fullName,
        role: UserRole.AUDIENCE,
        status: UserStatus.PENDING,
        createdAt: new Date(),
      });

      const result = await service.register(dto);
      expect(result).toBeDefined();
      expect(result.email).toBe(dto.email);
      expect(result.status).toBe(UserStatus.PENDING);
      expect(mockRedisService.set).toHaveBeenCalledTimes(2); // OTP & Rate Limit
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already registered', async () => {
      const dto = { email: 'exist@test.com', password: 'password', fullName: 'Exist User' };
      mockUserRepository.findOne.mockResolvedValue({ id: 'some-id' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('should throw 429 TooManyRequests if rate limit key exists on Redis', async () => {
      const dto = { email: 'spam@test.com', password: 'password', fullName: 'Spam User' };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockRedisService.get.mockResolvedValue('1'); // Rate limit hit

      await expect(service.register(dto)).rejects.toThrow(HttpException);
      await expect(service.register(dto)).rejects.toHaveProperty('status', HttpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP successfully and activate user', async () => {
      const dto = { email: 'pending@test.com', otp: '123456' };
      const user = { id: 'user-id', email: dto.email, status: UserStatus.PENDING };
      
      mockUserRepository.findOne.mockResolvedValue(user);
      mockRedisService.get.mockResolvedValue('123456'); // Correct OTP stored
      mockUserRepository.save.mockResolvedValue({ ...user, status: UserStatus.ACTIVE });

      const result = await service.verifyOtp(dto);
      expect(result).toEqual({ message: 'Account activated successfully' });
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(redisService.del).toHaveBeenCalledTimes(2); // Delete OTP & rate limit
    });

    it('should throw UnauthorizedException if OTP does not match', async () => {
      const dto = { email: 'pending@test.com', otp: 'wrong-otp' };
      const user = { id: 'user-id', email: dto.email, status: UserStatus.PENDING };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockRedisService.get.mockResolvedValue('123456'); // Correct is 123456

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if OTP has expired or not found', async () => {
      const dto = { email: 'pending@test.com', otp: '123456' };
      const user = { id: 'user-id', email: dto.email, status: UserStatus.PENDING };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockRedisService.get.mockResolvedValue(null); // Expired

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should login successfully if user is active', async () => {
      const dto = { email: 'active@test.com', password: 'password' };
      const passwordHash = await bcrypt.hash('password', 10);
      const user = { id: 'user-id', email: dto.email, passwordHash, role: UserRole.AUDIENCE, status: UserStatus.ACTIVE };

      mockUserRepository.findOne.mockResolvedValue(user);
      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login(dto);
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user status is pending', async () => {
      const dto = { email: 'pending@test.com', password: 'password' };
      const passwordHash = await bcrypt.hash('password', 10);
      const user = { id: 'user-id', email: dto.email, passwordHash, role: UserRole.AUDIENCE, status: UserStatus.PENDING };

      mockUserRepository.findOne.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(ForbiddenException);
    });
  });
});
