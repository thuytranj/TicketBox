import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RedisService } from '../redis/redis.service';

const IDEMPOTENCY_KEY_TTL = 86400; // 24 hours in seconds

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly redisService: RedisService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'] as string;

    // Skip if no idempotency key provided
    if (!idempotencyKey) {
      return next.handle();
    }

    const redisKey = `idempotency:${idempotencyKey}`;

    // Try to set a lock with NX (only if not exists)
    const lockSet = await this.redisService.set(
      `${redisKey}:lock`,
      'processing',
      'EX',
      30,  // 30s lock timeout
      'NX',
    );

    if (!lockSet) {
      // Lock already exists => request is currently being processed
      // Check if there's a stored result
      const cachedResult = await this.redisService.get(redisKey);
      if (cachedResult) {
        this.logger.log(`Idempotency cache hit for key: ${idempotencyKey}`);
        return of(JSON.parse(cachedResult));
      }
      // Still processing
      throw new ConflictException(
        'A request with this Idempotency-Key is already being processed. Please wait and retry.',
      );
    }

    // Check if result already exists (request was completed before)
    const cachedResult = await this.redisService.get(redisKey);
    if (cachedResult) {
      this.logger.log(`Returning cached result for Idempotency-Key: ${idempotencyKey}`);
      // Release lock since we're returning cached
      await this.redisService.del(`${redisKey}:lock`);
      return of(JSON.parse(cachedResult));
    }

    // Process the request and cache the result
    return next.handle().pipe(
      tap(async (responseBody) => {
        try {
          // Save result to Redis with TTL
          await this.redisService.set(
            redisKey,
            JSON.stringify(responseBody),
            'EX',
            IDEMPOTENCY_KEY_TTL,
          );
        } catch (err) {
          this.logger.error(`Failed to cache idempotency result for key: ${idempotencyKey}`, err);
        } finally {
          // Always release the lock
          await this.redisService.del(`${redisKey}:lock`);
        }
      }),
    );
  }
}
