import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { Resend } from 'resend';

jest.mock('resend');

describe('EmailService', () => {
  let service: EmailService;
  let mockResendInstance: any;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 're_test';
      if (key === 'MAIL_FROM') return 'no-reply@test.com';
      return null;
    }),
  };

  beforeEach(async () => {
    mockResendInstance = {
      emails: {
        send: jest.fn().mockResolvedValue({ data: { id: 'mock-id' }, error: null }),
      },
    };
    (Resend as jest.Mock).mockImplementation(() => mockResendInstance);

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
    expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['recipient@test.com'],
        subject: 'Verify your email - TicketBox',
        html: expect.stringContaining('Verify your email'),
      }),
    );
    expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('should send Reset Password email successfully with English template', async () => {
    await service.sendResetPasswordEmail('recipient@test.com', '654321');
    expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['recipient@test.com'],
        subject: 'Reset your password - TicketBox',
        html: expect.stringContaining('Reset your password'),
      }),
    );
    expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('654321'),
      }),
    );
  });

  it('should send VIP invitation email successfully with QR code attachment', async () => {
    const qrBuffer = Buffer.from('mock-qr');
    await service.sendVipInvitationEmail(
      'vip@test.com',
      'John VIP',
      'The Eras Tour',
      'hash123',
      qrBuffer,
    );
    expect(mockResendInstance.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['vip@test.com'],
        subject: 'VIP Ticket Invitation: The Eras Tour - TicketBox',
        html: expect.stringContaining('John VIP'),
        attachments: [
          {
            filename: 'qrcode.png',
            content: qrBuffer,
            contentId: 'vip-qr-code',
          },
        ],
      }),
    );
    const callArgs = mockResendInstance.emails.send.mock.calls[0][0];
    expect(callArgs.html).not.toContain('hash123');
  });

  it('should throw an error if Resend fails to send email', async () => {
    mockResendInstance.emails.send.mockResolvedValueOnce({
      data: null,
      error: { message: 'API Key invalid', name: 'validation_error' },
    });

    await expect(
      service.sendOtpEmail('recipient@test.com', '123456'),
    ).rejects.toThrow('Failed to send OTP email: API Key invalid');
  });
});
