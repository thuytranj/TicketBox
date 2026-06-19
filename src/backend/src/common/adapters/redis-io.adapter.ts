import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;

  private pubClient: Redis;
  private subClient: Redis;

  async connectToRedis(): Promise<void> {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

    this.logger.log(`Connecting Socket.io Redis Adapter to Redis at ${host}:${port}...`);

    this.pubClient = new Redis({
      host,
      port,
      maxRetriesPerRequest: null,
    });
    this.subClient = this.pubClient.duplicate({
      enableReadyCheck: false,
    });

    // Register persistent error handlers to avoid unhandled exceptions and warnings
    this.pubClient.on('error', (err) => {
      this.logger.error('Redis pubClient error:', err);
    });
    this.subClient.on('error', (err) => {
      this.logger.error('Redis subClient error:', err);
    });

    // Wait for both connections to establish successfully
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.pubClient.once('connect', () => resolve());
        this.pubClient.once('error', (err) => reject(err));
      }),
      new Promise<void>((resolve, reject) => {
        this.subClient.once('connect', () => resolve());
        this.subClient.once('error', (err) => reject(err));
      }),
    ]);

    this.logger.log('Socket.io Redis clients connected successfully. Initializing adapter.');
    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }

  async close(): Promise<void> {
    const promises: Promise<any>[] = [];
    if (this.pubClient) {
      promises.push(this.pubClient.quit());
    }
    if (this.subClient) {
      promises.push(this.subClient.quit());
    }
    await Promise.all(promises);
    this.logger.log('Socket.io Redis clients disconnected.');
  }
}
