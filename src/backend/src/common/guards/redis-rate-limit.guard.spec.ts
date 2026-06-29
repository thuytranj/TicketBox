import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { RedisRateLimitGuard } from './redis-rate-limit.guard';
import { REDIS_RATE_LIMIT_KEY } from '../decorators/redis-rate-limit.decorator';

describe('RedisRateLimitGuard', () => {
  let guard: RedisRateLimitGuard;
  let redisService: jest.Mocked<RedisService>;
  let reflector: jest.Mocked<Reflector>;

  const mockRedisService = {
    checkRateLimit: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisRateLimitGuard,
        { provide: RedisService, useValue: mockRedisService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<RedisRateLimitGuard>(RedisRateLimitGuard);
    redisService = module.get(RedisService);
    reflector = module.get(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if no rate limit metadata is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('should allow the request if rate limit is not exceeded', async () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 5, ttlMs: 60000 });
    redisService.checkRateLimit.mockResolvedValue(true);

    const context = createMockExecutionContext({
      user: { userId: 'user-123' },
      ip: '192.168.1.1',
      route: { path: '/bookings' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.checkRateLimit).toHaveBeenCalledWith(
      'rate_limit:user-123:/bookings',
      60000,
      5,
      expect.any(String),
    );
  });

  it('should fall back to IP if user is not authenticated', async () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 5, ttlMs: 60000 });
    redisService.checkRateLimit.mockResolvedValue(true);

    const context = createMockExecutionContext({
      ip: '192.168.1.1',
      route: { path: '/bookings' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.checkRateLimit).toHaveBeenCalledWith(
      'rate_limit:192.168.1.1:/bookings',
      60000,
      5,
      expect.any(String),
    );
  });

  it('should throw HttpException 429 and set X-RateLimit-Source header when limit is exceeded', async () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 5, ttlMs: 60000 });
    redisService.checkRateLimit.mockResolvedValue(false);

    const mockResponse = {
      header: jest.fn(),
    };

    const context = createMockExecutionContext(
      {
        user: { userId: 'user-123' },
        route: { path: '/bookings' },
      },
      mockResponse,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      new HttpException('Too many requests. Please slow down.', HttpStatus.TOO_MANY_REQUESTS),
    );

    expect(mockResponse.header).toHaveBeenCalledWith('X-RateLimit-Source', 'app-user');
  });

  it('should fail-open and allow the request if Redis throws an error', async () => {
    reflector.getAllAndOverride.mockReturnValue({ limit: 5, ttlMs: 60000 });
    redisService.checkRateLimit.mockRejectedValue(new Error('Redis connection error'));

    const context = createMockExecutionContext({
      user: { userId: 'user-123' },
      route: { path: '/bookings' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true); // Fail-open: allows request
  });

  function createMockExecutionContext(reqData = {}, resData = {}): ExecutionContext {
    const mockRequest = {
      headers: {},
      ...reqData,
    };
    const mockResponse = {
      header: jest.fn(),
      ...resData,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }
});
