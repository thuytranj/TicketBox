import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Emitter } from '@socket.io/redis-emitter';
import { RedisService } from '../common/redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly emitter: Emitter;

  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {
    this.emitter = new Emitter(this.redisService);
  }

  afterInit(server: Server) {
    this.logger.log(
      'NotificationGateway initialized. Registering JWT handshake middleware.',
    );

    server.use(async (socket, next) => {
      try {
        let token =
          socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token && socket.handshake.headers?.authorization) {
          const parts = socket.handshake.headers.authorization.split(' ');
          if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            token = parts[1];
          } else {
            token = socket.handshake.headers.authorization;
          }
        }

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const payload = await this.jwtService.verifyAsync(token);
        if (!payload || !payload.userId) {
          return next(new Error('Authentication error: Invalid token'));
        }

        socket.data.userId = payload.userId;
        next();
      } catch (err) {
        next(new Error(`Authentication error: ${err.message}`));
      }
    });
  }

  handleConnection(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.log(`Client ${client.id} connected and joined room user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  sendNotificationToUser(userId: string, event: string, data: any) {
    this.emitter.to(`user:${userId}`).emit(event, data);
    this.logger.log(
      `Published real-time event "${event}" to room user:${userId} via Redis Emitter`,
    );
  }

  // Helper method for testing/debugging
  isUserConnected(userId: string): boolean {
    // With distributed Redis Adapter, checking online state locally is not accurate.
    // For local tests, we return false or mock it.
    return false;
  }
}
