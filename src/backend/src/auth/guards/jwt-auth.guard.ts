import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly redisService: RedisService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Extract client IP address (trust proxy is enabled)
    const ip = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    const blockKey = `auth_blocked:${ip}`;
    const failKey = `auth_fail_count:${ip}`;

    // 1. Check if IP is blocked in Redis
    try {
      const isBlocked = await this.redisService.get(blockKey);
      if (isBlocked === '1') {
        this.logger.warn(`Request from IP ${ip} blocked due to excessive auth failures.`);
        response.header('X-RateLimit-Source', 'failed-auth-ip');
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many authentication failures. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      this.logger.error(`Redis check blocked IP failed (fail-open): ${err.message}`);
    }

    try {
      // 2. Perform standard JWT verification
      const isAllowed = await super.canActivate(context);
      return isAllowed as boolean;
    } catch (err) {
      // 3. Authentication failed: increment failure counter
      try {
        const currentFails = await this.redisService.incr(failKey);
        if (currentFails === 1) {
          await this.redisService.expire(failKey, 60); // 1 minute window
        }

        if (currentFails >= 5) {
          this.logger.warn(`IP ${ip} exceeded auth failure limit (${currentFails}/5). Blocking for 15 minutes.`);
          await this.redisService.set(blockKey, '1', 'EX', 900); // block for 15 mins
          await this.redisService.del(failKey); // reset count
        }
      } catch (redisErr) {
        this.logger.error(`Failed to update auth failure stats for IP ${ip}: ${redisErr.message}`);
      }

      // Re-throw the original authentication error
      throw err;
    }
  }
}
