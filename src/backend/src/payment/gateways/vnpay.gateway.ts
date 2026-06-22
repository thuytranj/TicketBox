import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  IPaymentGateway,
  CreatePaymentParams,
  PaymentUrlResult,
  WebhookVerifyResult,
} from './payment-gateway.interface';

/**
 * VNPAY Payment Gateway - Sandbox Integration
 * Docs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *
 * Sử dụng VNPAY Sandbox:
 *  - Payment URL: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
 *  - IPN xác thực chữ ký HMAC SHA512
 */
@Injectable()
export class VnpayGatewayService implements IPaymentGateway {
  private readonly logger = new Logger(VnpayGatewayService.name);
  private readonly paymentUrl =
    'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  private readonly tmnCode: string;
  private readonly hashSecret: string;

  constructor(private readonly configService: ConfigService) {
    // Đọc trực tiếp từ file .env để tránh lỗi cache process.env của nodemon
    const envPath = path.resolve(process.cwd(), '../../.env');
    let envConfig: Record<string, string> = {};
    if (fs.existsSync(envPath)) {
      envConfig = dotenv.parse(fs.readFileSync(envPath));
    } else if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
      envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env')));
    }

    this.tmnCode = envConfig['VNPAY_TMN_CODE'] || this.configService.get<string>('VNPAY_TMN_CODE', 'VNPAY_SANDBOX_CODE');
    this.hashSecret = envConfig['VNPAY_HASH_SECRET'] || this.configService.get<string>('VNPAY_HASH_SECRET', 'VNPAY_SANDBOX_SECRET');
    
    this.logger.log(`Loaded VNPAY config: TMN=${this.tmnCode}, Secret=${this.hashSecret.substring(0, 5)}***`);
  }

  /**
   * Tạo URL thanh toán VNPAY Sandbox
   * Luồng: NestJS → Tạo URL có chữ ký → Redirect khán giả → Khán giả thanh toán
   */
  async createPaymentUrl(params: CreatePaymentParams): Promise<PaymentUrlResult> {
    // CHEAT CODE ĐỂ TEST CIRCUIT BREAKER (VNPAY không bao giờ sập do chỉ tạo URL offline, nên phải dùng cheat code mới test được)
    if (params.orderInfo && params.orderInfo.includes('FAIL_VNPAY')) {
      this.logger.error('Cheat code kích hoạt: Giả lập VNPAY bị lỗi!');
      throw new Error('Simulated VNPAY Error for Circuit Breaker Test');
    }

    const now = new Date();
    const vnp_CreateDate = this.formatDate(now);
    const vnp_ExpireDate = this.formatDate(
      new Date(now.getTime() + 10 * 60 * 1000), // 10 phút
    );

    let vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: String(params.amount * 100), // VNPAY yêu cầu * 100
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddress || '127.0.0.1',
      vnp_CreateDate,
      vnp_ExpireDate,
    };

    // Sắp xếp params theo thứ tự alphabet (bắt buộc của VNPAY)
    vnpParams = this.sortObject(vnpParams);

    const signData = this.buildVnpayQueryString(vnpParams);
    const signature = crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    const payUrl = `${this.paymentUrl}?${signData}&vnp_SecureHash=${signature}`;

    this.logger.log(
      `Created VNPAY payment URL for order ${params.orderId}, amount: ${params.amount}`,
    );

    return { payUrl };
  }

  /**
   * Xác thực chữ ký IPN từ VNPAY
   * VNPAY sẽ gọi IPN URL sau khi khán giả thanh toán xong
   */
  verifyWebhook(payload: Record<string, any>): WebhookVerifyResult {
    const secureHash = payload['vnp_SecureHash'];

    // Loại bỏ vnp_SecureHash và vnp_SecureHashType để tính lại chữ ký
    const verifyParams = { ...payload };
    delete verifyParams['vnp_SecureHash'];
    delete verifyParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(verifyParams);
    const signData = this.buildVnpayQueryString(sortedParams);

    const computedHash = crypto
      .createHmac('sha512', this.hashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    const isValid = computedHash === secureHash;

    if (!isValid) {
      this.logger.warn(
        `Invalid VNPAY IPN signature for order ${payload['vnp_TxnRef']}`,
      );
    }

    const resultCode = payload['vnp_ResponseCode'];
    const isSuccess = resultCode === '00';

    return {
      isValid,
      orderId: payload['vnp_TxnRef'] as string,
      transactionId: String(payload['vnp_TransactionNo']),
      amount: Number(payload['vnp_Amount']) / 100, // Chia 100 lại để ra VND thực
      resultCode,
      message: isSuccess ? 'Thanh toán thành công' : `Lỗi: ${resultCode}`,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Sắp xếp object theo alphabet key - bắt buộc của VNPAY
   */
  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== '' && v !== null && v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  }

  /**
   * Format ngày theo format VNPAY yêu cầu: YYYYMMDDHHmmss
   */
  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  /**
   * Định dạng query string theo đúng chuẩn VNPAY (chuyển %20 thành +)
   */
  private buildVnpayQueryString(obj: Record<string, string>): string {
    const str: string[] = [];
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    
    const query: string[] = [];
    for (let i = 0; i < str.length; i++) {
      const key = str[i];
      const val = encodeURIComponent(obj[key]).replace(/%20/g, '+');
      query.push(key + '=' + val);
    }
    return query.join('&');
  }
}
