import { Test, TestingModule } from '@nestjs/testing';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { EmailService } from './email.service';
import { NotificationConsumer } from './notification.consumer';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let mockChannel: any;

  const mockRabbitMQService = {
    consume: jest.fn(),
    getChannel: jest.fn(),
  };

  const mockEmailService = {
    sendOtpEmail: jest.fn(),
    sendResetPasswordEmail: jest.fn(),
  };

  beforeEach(async () => {
    mockChannel = {
      ack: jest.fn(),
      nack: jest.fn(),
      assertExchange: jest.fn().mockResolvedValue({}),
      assertQueue: jest.fn().mockResolvedValue({}),
      bindQueue: jest.fn().mockResolvedValue({}),
    };
    mockRabbitMQService.getChannel.mockReturnValue(mockChannel);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConsumer,
        {
          provide: RabbitMQService,
          useValue: mockRabbitMQService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    consumer = module.get<NotificationConsumer>(NotificationConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  it('should register consume listener on init', async () => {
    await consumer.onModuleInit();
    expect(mockRabbitMQService.consume).toHaveBeenCalledWith(
      'notification.email.otp',
      expect.any(Function),
    );
  });

  it('should process and ack message of type verify', async () => {
    await consumer.onModuleInit();
    const handler = mockRabbitMQService.consume.mock.calls[0][1];

    const messageContent = {
      email: 'test@example.com',
      otp: '123456',
      type: 'verify',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(messageContent)),
    } as any;

    await handler(mockMsg);

    expect(mockEmailService.sendOtpEmail).toHaveBeenCalledWith(
      'test@example.com',
      '123456',
    );
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
  });

  it('should process and ack message of type reset', async () => {
    await consumer.onModuleInit();
    const handler = mockRabbitMQService.consume.mock.calls[0][1];

    const messageContent = {
      email: 'test@example.com',
      otp: '654321',
      type: 'reset',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(messageContent)),
    } as any;

    await handler(mockMsg);

    expect(mockEmailService.sendResetPasswordEmail).toHaveBeenCalledWith(
      'test@example.com',
      '654321',
    );
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
  });

  it('should nack message on email service error', async () => {
    await consumer.onModuleInit();
    const handler = mockRabbitMQService.consume.mock.calls[0][1];

    mockEmailService.sendOtpEmail.mockRejectedValue(new Error('SMTP error'));

    const messageContent = {
      email: 'test@example.com',
      otp: '123456',
      type: 'verify',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(messageContent)),
    } as any;

    await handler(mockMsg);

    expect(mockEmailService.sendOtpEmail).toHaveBeenCalled();
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
  });
});
