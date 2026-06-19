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
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    this.logger.log('NotificationGateway initialized. Registering JWT handshake middleware.');
    
    server.use(async (socket, next) => {
      try {
        let token = socket.handshake.auth?.token || socket.handshake.query?.token;
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
      let sockets = this.userSockets.get(userId);
      if (!sockets) {
        sockets = new Set<string>();
        this.userSockets.set(userId, sockets);
      }
      sockets.add(client.id);

      this.logger.log(`Client ${client.id} connected for user ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
    this.logger.log(`Client ${client.id} disconnected`);
  }

  sendNotificationToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
      this.logger.log(`Pushed real-time event "${event}" to user ${userId} (${sockets.size} active connections)`);
    } else {
      this.logger.log(`User ${userId} is offline, skipping real-time push`);
    }
  }

  // Helper method for testing/debugging
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }
}
