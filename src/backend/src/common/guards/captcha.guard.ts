import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly logger = new Logger(CaptchaGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-captcha-token'];

    if (!token) {
      this.logger.warn('Missing Captcha token in headers');
      throw new ForbiddenException('Captcha verification failed. Token missing.');
    }

    // Bypass check for dev environment or dummy testing
    const env = this.configService.get<string>('NODE_ENV');
    if (env === 'development' && token === 'test-dummy-token') {
      return true;
    }

    const secretKey = this.configService.get<string>('CAPTCHA_SECRET_KEY');
    const verifyUrl = this.configService.get<string>('CAPTCHA_VERIFY_URL');

    if (!secretKey || !verifyUrl) {
      this.logger.error('Captcha configuration is missing from .env');
      // If config is missing, we shouldn't block the request in dev, but in prod we might want to.
      if (env === 'development') return true;
      throw new ForbiddenException('Captcha configuration error');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          verifyUrl,
          new URLSearchParams({
            secret: secretKey,
            response: token,
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      ) as any;

      if (response.data.success) {
        return true;
      } else {
        this.logger.warn(`Captcha verification failed: ${JSON.stringify(response.data['error-codes'])}`);
        throw new ForbiddenException('Captcha verification failed. Are you a bot?');
      }
    } catch (error) {
      this.logger.error('Error verifying captcha', error);
      throw new ForbiddenException('Unable to verify captcha at this time.');
    }
  }
}
