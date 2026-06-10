import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SMTP_HOST') return 'smtp.test.com';
      if (key === 'SMTP_PORT') return 587;
      if (key === 'SMTP_USER') return 'user@test.com';
      if (key === 'SMTP_PASSWORD') return 'pass';
      if (key === 'SMTP_FROM_EMAIL') return 'no-reply@test.com';
      return null;
    }),
  };

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: '123' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send OTP email successfully with English template', async () => {
    await service.sendOtpEmail('recipient@test.com', '123456');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@test.com',
        subject: 'Verify your email - TicketBox',
        html: expect.stringContaining('Verify your email'),
      }),
    );
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('should send Reset Password email successfully with English template', async () => {
    await service.sendResetPasswordEmail('recipient@test.com', '654321');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recipient@test.com',
        subject: 'Reset your password - TicketBox',
        html: expect.stringContaining('Reset your password'),
      }),
    );
    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('654321'),
      }),
    );
  });
});
