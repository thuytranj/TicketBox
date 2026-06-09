import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { User, UserRole } from './entities/user.entity';
import { RedisService } from '../common/redis/redis.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let jwtService: JwtService;
  let redisService: RedisService;

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto = { email: 'new@test.com', password: 'password', fullName: 'New User' };
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        ...dto,
        id: 'uuid-7',
        role: UserRole.AUDIENCE,
      });
      mockUserRepository.save.mockResolvedValue({
        id: 'uuid-7',
        email: dto.email,
        passwordHash: 'hashed-password',
        fullName: dto.fullName,
        role: UserRole.AUDIENCE,
        createdAt: new Date(),
      });

      const result = await service.register(dto);
      expect(result).toBeDefined();
      expect(result.email).toBe(dto.email);
      expect(result.fullName).toBe(dto.fullName);
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw ConflictException if email already registered', async () => {
      const dto = { email: 'exist@test.com', password: 'password', fullName: 'Exist User' };
      mockUserRepository.findOne.mockResolvedValue({ id: 'some-id' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login successfully and return tokens', async () => {
      const dto = { email: 'test@test.com', password: 'password' };
      const passwordHash = await bcrypt.hash('password', 10);
      const user = { id: 'user-id', email: dto.email, passwordHash, role: UserRole.AUDIENCE };

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

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { email: 'nonexist@test.com', password: 'password' };
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const dto = { email: 'test@test.com', password: 'wrongpassword' };
      const passwordHash = await bcrypt.hash('password', 10);
      const user = { id: 'user-id', email: dto.email, passwordHash, role: UserRole.AUDIENCE };

      mockUserRepository.findOne.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
