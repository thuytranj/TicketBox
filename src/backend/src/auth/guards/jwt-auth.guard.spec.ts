import { ExecutionContext, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../../common/redis/redis.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let redisService: jest.Mocked<RedisService>;
  let superCanActivateSpy: jest.SpyInstance;

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    // Spy on the parent AuthGuard's canActivate method
    superCanActivateSpy = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    redisService = module.get(RedisService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
    superCanActivateSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request if IP is not blocked and JWT is valid', async () => {
    redisService.get.mockResolvedValue(null);
    superCanActivateSpy.mockResolvedValue(true);

    const context = createMockExecutionContext('1.2.3.4');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(redisService.get).toHaveBeenCalledWith('auth_blocked:1.2.3.4');
    expect(superCanActivateSpy).toHaveBeenCalled();
  });

  it('should block request immediately with 429 if IP is blocked', async () => {
    redisService.get.mockResolvedValue('1');

    const mockResponse = {
      header: jest.fn(),
    };
    const context = createMockExecutionContext('1.2.3.4', mockResponse);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new HttpException(
        'Too many authentication failures. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

    expect(redisService.get).toHaveBeenCalledWith('auth_blocked:1.2.3.4');
    expect(mockResponse.header).toHaveBeenCalledWith('X-RateLimit-Source', 'failed-auth-ip');
    expect(superCanActivateSpy).not.toHaveBeenCalled();
  });

  it('should fail-open and run JWT verification if Redis fails when checking block status', async () => {
    redisService.get.mockRejectedValue(new Error('Redis connection error'));
    superCanActivateSpy.mockResolvedValue(true);

    const context = createMockExecutionContext('1.2.3.4');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(superCanActivateSpy).toHaveBeenCalled();
  });

  it('should increment fail count on JWT failure', async () => {
    redisService.get.mockResolvedValue(null);
    superCanActivateSpy.mockRejectedValue(new UnauthorizedException());
    redisService.incr.mockResolvedValue(1);

    const context = createMockExecutionContext('1.2.3.4');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);

    expect(redisService.incr).toHaveBeenCalledWith('auth_fail_count:1.2.3.4');
    expect(redisService.expire).toHaveBeenCalledWith('auth_fail_count:1.2.3.4', 60);
  });

  it('should block IP for 15 minutes and reset fail count if failures reach 5', async () => {
    redisService.get.mockResolvedValue(null);
    superCanActivateSpy.mockRejectedValue(new UnauthorizedException());
    redisService.incr.mockResolvedValue(5);

    const context = createMockExecutionContext('1.2.3.4');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);

    expect(redisService.incr).toHaveBeenCalledWith('auth_fail_count:1.2.3.4');
    expect(redisService.set).toHaveBeenCalledWith('auth_blocked:1.2.3.4', '1', 'EX', 900);
    expect(redisService.del).toHaveBeenCalledWith('auth_fail_count:1.2.3.4');
  });

  function createMockExecutionContext(ip: string, resData = {}): ExecutionContext {
    const mockRequest = {
      ip,
      headers: {},
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
    } as unknown as ExecutionContext;
  }
});
