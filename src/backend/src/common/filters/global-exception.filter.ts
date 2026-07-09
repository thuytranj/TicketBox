import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined = undefined;
    let error: string | undefined;
    let code: string | undefined;
    let responseStatus: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resBody = exception.getResponse();

      if (typeof resBody === 'string') {
        message = resBody;
      } else if (typeof resBody === 'object' && resBody !== null) {
        const body = resBody as any;
        error = typeof body.error === 'string' ? body.error : undefined;
        code = typeof body.code === 'string' ? body.code : undefined;
        responseStatus =
          typeof body.status === 'string' ? body.status : undefined;

        if (Array.isArray(body.message)) {
          errors = body.message;
          message = 'Validation failed';
        } else {
          message = body.message || message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(code != null ? { code } : {}),
      ...(responseStatus != null ? { status: responseStatus } : {}),
      ...(error != null ? { error } : {}),
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
