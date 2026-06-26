import { SetMetadata } from '@nestjs/common';

export interface RedisRateLimitOptions {
  limit: number;
  ttlMs: number;
}

export const REDIS_RATE_LIMIT_KEY = 'redis_rate_limit';

export const RedisRateLimit = (options: RedisRateLimitOptions) =>
  SetMetadata(REDIS_RATE_LIMIT_KEY, options);
