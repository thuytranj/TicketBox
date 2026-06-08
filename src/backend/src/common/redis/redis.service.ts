import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

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
  }

  onModuleDestroy() {
    this.logger.log('Disconnecting from Redis...');
    this.disconnect();
  }
}
