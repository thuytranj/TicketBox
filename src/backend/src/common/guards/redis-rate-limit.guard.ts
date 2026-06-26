import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';
import { REDIS_RATE_LIMIT_KEY, RedisRateLimitOptions } from '../decorators/redis-rate-limit.decorator';

@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RedisRateLimitOptions>(
      REDIS_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true; // No rate limit configured on this handler
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract tracker: defaults to User ID if authenticated, falls back to client IP
    const userId = request.user?.userId;
    const tracker = userId || request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    const endpoint = request.route?.path || request.url;
    const key = `rate_limit:${tracker}:${endpoint}`;

    // Generate a unique ID to ensure ZSET members are unique
    const uniqueId = Math.random().toString(36).substring(2, 15);

    try {
      const isAllowed = await this.redisService.checkRateLimit(
        key,
        options.ttlMs,
        options.limit,
        uniqueId,
      );

      if (!isAllowed) {
        response.header('X-RateLimit-Source', 'app-user');
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests. Please slow down.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      // Fail-Open strategy: if Redis connection/command fails, log error and allow request
      if (err instanceof HttpException) {
        throw err; // Re-throw 429 HttpException
      }
      this.logger.error(
        `Redis rate limiter failed for key ${key}: ${err.message}. Fail-open allowed request.`,
        err.stack,
      );
    }

    return true;
  }
}
