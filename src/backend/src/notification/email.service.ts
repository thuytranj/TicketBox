import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface EmailTemplateOptions {
  title: string;
  description: string;
  headerBgColor?: string;
  contentHtml?: string;
  footerText?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private resend: Resend;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
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

    const fromEmail = this.configService.get<string>('MAIL_FROM') || 'no-reply@ticketboxz.me';
    const { error } = await this.resend.emails.send({
      from: `TicketBox <${fromEmail}>`,
      to: [to],
      subject: 'Verify your email - TicketBox',
      html,
    });

    if (error) {
      throw new Error(`Failed to send OTP email: ${error.message}`);
    }
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

    const fromEmail = this.configService.get<string>('MAIL_FROM') || 'no-reply@ticketboxz.me';
    const { error } = await this.resend.emails.send({
      from: `TicketBox Support <${fromEmail}>`,
      to: [to],
      subject: 'Reset your password - TicketBox',
      html,
    });

    if (error) {
      throw new Error(`Failed to send Reset Password email: ${error.message}`);
    }
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
              <div>
                <img 
                  src="cid:vip-qr-code" 
                  alt="VIP Ticket QR Pass" 
                  width="160" 
                  height="160" 
                  style="display: inline-block; border: 1px solid #e2e8f0; padding: 5px; border-radius: 4px;"
                />
              </div>
            </td>
          </tr>
        </table>
      `,
      footerText: 'This email contains your VIP entry pass. Please do not share this email or your QR code signature with anyone.',
    });

    const fromEmail = this.configService.get<string>('MAIL_FROM') || 'no-reply@ticketboxz.me';
    const { error } = await this.resend.emails.send({
      from: `TicketBox Events <${fromEmail}>`,
      to: [to],
      subject: `VIP Ticket Invitation: ${concertTitle} - TicketBox`,
      html,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrBuffer,
          contentId: 'vip-qr-code',
        },
      ],
    });

    if (error) {
      throw new Error(`Failed to send VIP invitation email: ${error.message}`);
    }
  }

  /**
   * Gửi email E-ticket tổng hợp cho tất cả vé trong một đơn hàng
   * Bao gồm thông tin concert + danh sách vé + QR code inline cho mỗi vé
   */
  async sendETicketEmail(
    to: string,
    fullName: string,
    concertTitle: string,
    concertDate: string,
    concertLocation: string,
    tickets: Array<{ ticketId: string; ticketTypeName: string; qrBuffer: Buffer }>,
  ): Promise<void> {
    // Build HTML cho từng vé
    const ticketRowsHtml = tickets
      .map(
        (ticket, index) => `
        <tr>
          <td style="padding: 10px 0; border-top: 1px dashed #e2e8f0;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size: 11px; color: #64748b;">Ticket ${index + 1}</td>
              </tr>
              <tr>
                <td style="padding: 3px 0;">
                  <strong>Type:</strong> ${ticket.ticketTypeName}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; text-align: center;">
                  <img
                    src="cid:ticket-qr-${index}"
                    alt="Ticket QR Code"
                    width="140"
                    height="140"
                    style="display: inline-block; border: 1px solid #e2e8f0; padding: 4px; border-radius: 4px;"
                  />
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
      )
      .join('');

    const html = this.buildMasterTemplate({
      title: 'Your E-Tickets',
      description: `Hi ${fullName},<br><br>Your booking for "<strong>${concertTitle}</strong>" has been confirmed! Here are your e-tickets.`,
      headerBgColor: '#059669',
      contentHtml: `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px; color: #334155; line-height: 1.5;">
          <tr>
            <td style="padding: 5px 0;">
              <strong>Concert:</strong> ${concertTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Date:</strong> ${concertDate}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Location:</strong> ${concertLocation}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Total Tickets:</strong> ${tickets.length}
            </td>
          </tr>
          ${ticketRowsHtml}
        </table>
      `,
      footerText:
        'Please present the QR code at the venue entrance for check-in. Do not share your tickets with anyone.',
    });

    const attachments = tickets.map((ticket, index) => ({
      filename: `ticket-qr-${index}.png`,
      content: ticket.qrBuffer,
      contentId: `ticket-qr-${index}`,
    }));

    const fromEmail =
      this.configService.get<string>('MAIL_FROM') || 'no-reply@ticketboxz.me';
    const { error } = await this.resend.emails.send({
      from: `TicketBox <${fromEmail}>`,
      to: [to],
      subject: `Your E-Tickets: ${concertTitle} - TicketBox`,
      html,
      attachments,
    });

    if (error) {
      throw new Error(`Failed to send E-ticket email: ${error.message}`);
    }
  }

  /**
   * Gửi email nhắc nhở concert sắp diễn ra trong 24h
   */
  async sendConcertReminderEmail(
    to: string,
    fullName: string,
    concertTitle: string,
    concertDate: string,
    concertLocation: string,
  ): Promise<void> {
    const html = this.buildMasterTemplate({
      title: 'Concert Reminder',
      description: `Hi ${fullName},<br><br>This is a friendly reminder that "<strong>${concertTitle}</strong>" is happening tomorrow! Don't forget to bring your e-ticket.`,
      headerBgColor: '#d97706',
      contentHtml: `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px; color: #334155; line-height: 1.5;">
          <tr>
            <td style="padding: 5px 0;">
              <strong>Concert:</strong> ${concertTitle}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Date:</strong> ${concertDate}
            </td>
          </tr>
          <tr>
            <td style="padding: 5px 0;">
              <strong>Location:</strong> ${concertLocation}
            </td>
          </tr>
        </table>
      `,
      footerText:
        'Make sure to arrive early and have your e-ticket QR code ready for check-in at the venue.',
    });

    const fromEmail =
      this.configService.get<string>('MAIL_FROM') || 'no-reply@ticketboxz.me';
    const { error } = await this.resend.emails.send({
      from: `TicketBox <${fromEmail}>`,
      to: [to],
      subject: `Reminder: ${concertTitle} is tomorrow! - TicketBox`,
      html,
    });

    if (error) {
      throw new Error(
        `Failed to send concert reminder email: ${error.message}`,
      );
    }
  }
}
