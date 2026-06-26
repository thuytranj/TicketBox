import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(configService: ConfigService) {
    const host = configService.get<string>('REDIS_HOST', 'localhost');
    const port = parseInt(configService.get<string>('REDIS_PORT', '6379'), 10);

    super({
      host,
      port,
      maxRetriesPerRequest: null,
    });

    this.on('connect', () => {
      this.logger.log(`Successfully connected to Redis at ${host}:${port}`);
    });

    this.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });

    // Load and register sliding window rate limit Lua script
    const scriptPath = join(__dirname, 'scripts', 'sliding-window-rate-limit.lua');
    try {
      const luaScript = readFileSync(scriptPath, 'utf8');
      this.defineCommand('slidingWindowRateLimit', {
        numberOfKeys: 1,
        lua: luaScript,
      });
      this.logger.log('Successfully registered slidingWindowRateLimit Redis command');
    } catch (err) {
      this.logger.error('Failed to load sliding-window-rate-limit.lua script:', err);
    }
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.set(key, 'locked', 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async releaseLock(key: string): Promise<void> {
    await this.del(key);
  }

  async checkRateLimit(
    key: string,
    windowMs: number,
    maxRequests: number,
    uniqueId: string,
  ): Promise<boolean> {
    const result = await (this as any).slidingWindowRateLimit(
      key,
      windowMs.toString(),
      maxRequests.toString(),
      uniqueId,
    );
    return result === 1;
  }

  onModuleDestroy() {
    this.logger.log('Disconnecting from Redis...');
    this.disconnect();
  }
}
