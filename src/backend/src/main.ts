import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RedisIoAdapter } from './common/adapters/redis-io.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const role = process.env.INSTANCE_ROLE ?? 'all';

  if (role.startsWith('worker') || role.startsWith('worker:')) {
    logger.log(
      `Starting TicketBox Backend in standalone Worker mode (INSTANCE_ROLE: ${role})...`,
    );
    const app = await NestFactory.createApplicationContext(AppModule);
    logger.log('Worker context initialized successfully.');
  } else {
    logger.log(
      `Starting TicketBox Backend in HTTP API mode (INSTANCE_ROLE: ${role})...`,
    );
    const app = await NestFactory.create(AppModule);
    app.enableCors({
      origin: '*', // Trong production, bạn có thể thay thế bằng domain frontend cụ thể (ví dụ: https://ticketboxz.me) để bảo mật hơn
      credentials: true,
    });
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.setGlobalPrefix('api/v1');

    // Setup Socket.io Redis Adapter for cluster scaling
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);

    // Enable global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    // Enable global response transformation interceptor
    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new TransformInterceptor(reflector));

    // Enable global exception filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`API application is running on: http://localhost:${port}`);
  }
}
bootstrap();
