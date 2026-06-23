import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailTemplateOptions {
  title: string;
  description: string;
  headerBgColor?: string;
  contentHtml?: string;
  footerText?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: false, // true for 465, false for other ports (587 TLS)
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  private buildMasterTemplate(options: EmailTemplateOptions): string {
    const {
      title,
      description,
      headerBgColor = '#0f172a',
      contentHtml = '',
      footerText = 'If you did not make this request, you can safely ignore this email.',
    } = options;

    return `
      <div style="background-color: #f8fafc; padding: 20px 5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; min-height: 100%;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 240px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: separate; box-shadow: 0 2px 3px -1px rgb(0 0 0 / 0.05);">
          <!-- HEADER -->
          <tr>
            <td style="background-color: ${headerBgColor}; padding: 20px 15px; border-top-left-radius: 7px; border-top-right-radius: 7px;">
              <h1 style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 0; letter-spacing: -0.025em;">
                ${title}
              </h1>
            </td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="padding: 20px 15px; background-color: #ffffff;">
              <p style="color: #334155; font-size: 12px; line-height: 1.5; margin: 0 0 15px 0;">
                ${description}
              </p>
              <!-- DYNAMIC CONTENT -->
              ${contentHtml}
              <!-- FOOTER -->
              <p style="color: #64748b; font-size: 10px; margin: 15px 0 0 0; line-height: 1.4;">
                ${footerText}
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    const html = this.buildMasterTemplate({
      title: 'Verify your email',
      description:
        'Thanks for signing up. Please use the OTP below to verify your email address.',
      headerBgColor: '#0f172a',
      contentHtml: `
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="background-color: #eff6ff; border: 1px dashed #4f46e5; border-radius: 6px; padding: 12px; text-align: center;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: 800; letter-spacing: 5px; color: #0f172a; display: block; margin-left: 5px;">
                ${otp}
              </span>
            </td>
          </tr>
        </table>
      `,
    });

    await this.transporter.sendMail({
      from: `"TicketBox" <${this.configService.get<string>('SMTP_FROM_EMAIL')}>`,
      to,
      subject: 'Verify your email - TicketBox',
      html,
    });
  }

  async sendResetPasswordEmail(to: string, otp: string): Promise<void> {
    const html = this.buildMasterTemplate({
      title: 'Reset your password',
      description:
        'You have requested to reset your password. Please use the OTP below to complete the verification.',
      headerBgColor: '#311005',
      contentHtml: `
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="background-color: #fffbeb; border: 1px dashed #d97706; border-radius: 6px; padding: 12px; text-align: center;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 20px; font-weight: 800; letter-spacing: 5px; color: #78350f; display: block; margin-left: 5px;">
                ${otp}
              </span>
            </td>
          </tr>
        </table>
      `,
      footerText:
        'If you did not request a password reset, your password will remain unchanged. However, we recommend checking your account security.',
    });

    await this.transporter.sendMail({
      from: `"TicketBox Support" <${this.configService.get<string>('SMTP_FROM_EMAIL')}>`,
      to,
      subject: 'Reset your password - TicketBox',
      html,
    });
  }

  async sendVipInvitationEmail(
    to: string,
    guestName: string,
    concertTitle: string,
    qrCodeHash: string,
    qrBuffer: Buffer,
  ): Promise<void> {
    const html = this.buildMasterTemplate({
      title: 'VIP Ticket Invitation',
      description: `Dear ${guestName},<br><br>You have been registered as a VIP guest for the concert "<strong>${concertTitle}</strong>". Please find your ticket details below.`,
      headerBgColor: '#4f46e5',
      contentHtml: `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px; color: #334155; line-height: 1.5;">
          <tr>
            <td style="padding: 5px 0;">
              <strong>Guest Name:</strong> ${guestName}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Concert:</strong> ${concertTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 15px 0; text-align: center;">
              <div style="margin-bottom: 15px;">
                <img 
                  src="cid:vip-qr-code" 
                  alt="VIP Ticket QR Pass" 
                  width="160" 
                  height="160" 
                  style="display: inline-block; border: 1px solid #e2e8f0; padding: 5px; border-radius: 4px;"
                />
              </div>
              <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; display: inline-block; width: 90%;">
                <span style="font-family: monospace; font-size: 13px; font-weight: bold; color: #1e293b; display: block;">
                  Verification Signature
                </span>
                <span style="font-family: monospace; font-size: 11px; color: #64748b; display: block; word-break: break-all; margin-top: 5px; line-height: 1.3;">
                  ${qrCodeHash}
                </span>
              </div>
            </td>
          </tr>
        </table>
      `,
      footerText: 'This email contains your VIP entry pass. Please do not share this email or your QR code signature with anyone.',
    });

    await this.transporter.sendMail({
      from: `"TicketBox Events" <${this.configService.get<string>('SMTP_FROM_EMAIL')}>`,
      to,
      subject: `VIP Ticket Invitation: ${concertTitle} - TicketBox`,
      html,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrBuffer,
          cid: 'vip-qr-code',
        },
      ],
    });
  }
}
