import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { NotificationService } from '../src/notification/notification.service';
import { io, Socket } from 'socket.io-client';
import {
  NotificationType,
  NotificationChannel,
} from '../src/notification/entities/notification-log.entity';

describe('NotificationGateway (e2e WebSockets)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let notificationService: NotificationService;
  let clientSocket: Socket;
  let port: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const address = app.getHttpServer().address();
    port = typeof address === 'string' ? 3000 : address.port;

    jwtService = app.get<JwtService>(JwtService);
    notificationService = app.get<NotificationService>(NotificationService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should disconnect if no token is provided', (done) => {
    clientSocket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      timeout: 1000,
    });

    let calledDone = false;
    let timeoutId: NodeJS.Timeout;

    const triggerDone = (err?: any) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!calledDone) {
        calledDone = true;
        done(err);
      }
    };

    clientSocket.on('connect_error', () => {
      triggerDone();
    });

    clientSocket.on('disconnect', () => {
      triggerDone();
    });

    clientSocket.on('connect', () => {
      triggerDone(new Error('Should not connect without token'));
    });

    timeoutId = setTimeout(() => {
      triggerDone();
    }, 1500);
  });

  it('should connect successfully with valid token and receive push notification', (done) => {
    const userId = '11111111-2222-3333-4444-555555555555';
    const token = jwtService.sign({
      userId,
      email: 'user@test.com',
      role: 'organizer',
    });

    clientSocket = io(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    clientSocket.on('connect', async () => {
      try {
        await notificationService.createNotification(userId, {
          type: NotificationType.AI_BIO_COMPLETED,
          title: 'Real-time Test',
          body: 'Real-time Push Works!',
          channel: NotificationChannel.IN_APP,
        });
      } catch (err) {
        done(err);
      }
    });

    clientSocket.on('notification_received', (data) => {
      try {
        expect(data).toBeDefined();
        expect(data.userId).toBe(userId);
        expect(data.title).toBe('Real-time Test');
        expect(data.body).toBe('Real-time Push Works!');
        done();
      } catch (err) {
        done(err);
      }
    });
  });
});
