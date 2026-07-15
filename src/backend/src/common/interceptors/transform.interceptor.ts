import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BYPASS_INTERCEPTOR_KEY } from '../decorators/bypass-interceptor.decorator';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | T
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    const isBypassed = this.reflector.getAllAndOverride<boolean>(
      BYPASS_INTERCEPTOR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (isBypassed) {
      return next.handle();
    }

    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const statusCode = response.statusCode;

    return next.handle().pipe(
      map((data) => {
        let message = 'Request processed successfully';
        let resultData = data;

        if (data && typeof data === 'object') {
          if ('message' in data) {
            message = data.message;
            const { message: _, ...rest } = data;
            resultData = Object.keys(rest).length > 0 ? rest : null;
          }
        }

        return {
          success: true,
          statusCode,
          message,
          data: resultData === undefined ? null : resultData,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
