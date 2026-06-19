import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    const url = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://localhost:5673',
    );
    try {
      this.logger.log(`Connecting to RabbitMQ at ${url}...`);
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      this.logger.log(
        'Successfully connected to RabbitMQ and created a channel',
      );

      this.connection.on('error', (err) => {
        this.logger.error('RabbitMQ connection error:', err);
      });

      this.connection.on('close', () => {
        this.logger.warn('RabbitMQ connection closed');
      });
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  getChannel(): amqp.Channel {
    return this.channel;
  }

  getConnection(): amqp.ChannelModel {
    return this.connection;
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: any,
    options?: amqp.Options.Publish,
  ) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }
    const messageBuffer = Buffer.from(JSON.stringify(content));
    return this.channel.publish(exchange, routingKey, messageBuffer, options);
  }

  async sendToQueue(
    queue: string,
    content: any,
    options?: amqp.Options.Publish,
  ) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }
    const messageBuffer = Buffer.from(JSON.stringify(content));
    await this.channel.assertQueue(queue, { durable: true });
    return this.channel.sendToQueue(queue, messageBuffer, options);
  }

  async consume(
    queue: string,
    onMessage: (msg: amqp.ConsumeMessage | null) => void,
    options?: amqp.Options.Consume,
  ) {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not initialized');
    }
    await this.channel.assertQueue(queue, { durable: true });
    return this.channel.consume(queue, onMessage, options);
  }

  async onModuleDestroy() {
    this.logger.log('Closing RabbitMQ channel and connection...');
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error('Error during RabbitMQ shutdown:', error);
    }
  }
}
