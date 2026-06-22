import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import {
  IPaymentGateway,
  CreatePaymentParams,
  PaymentUrlResult,
  WebhookVerifyResult,
} from './payment-gateway.interface';

/**
 * MoMo Payment Gateway - Sandbox Integration
 * Docs: https://developers.momo.vn/v3/docs/payment/api/wallet-api/create-order-at-app
 *
 * Sử dụng MoMo Sandbox với môi trường:
 *  - Endpoint: https://test-payment.momo.vn/v2/gateway/api/create
 *  - requestType: payWithMethod (hỗ trợ cả ví MoMo lẫn QR code)
 */
@Injectable()
export class MomoGatewayService implements IPaymentGateway {
  private readonly logger = new Logger(MomoGatewayService.name);
  private readonly endpoint =
    'https://test-payment.momo.vn/v2/gateway/api/create';
  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    // Đọc trực tiếp từ file .env để tránh lỗi cache process.env của nodemon
    let envConfig: Record<string, string> = {};
    const envPaths = [
      path.resolve(process.cwd(), '../../.env'),
      path.resolve(process.cwd(), '.env'),
    ];
    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const [k, ...rest] = line.split('=');
          if (k && rest.length) envConfig[k.trim()] = rest.join('=').trim().replace(/\r$/, '');
        }
        break;
      }
    }

    this.partnerCode = envConfig['MOMO_PARTNER_CODE'] || this.configService.get<string>('MOMO_PARTNER_CODE', 'MOMO');
    this.accessKey = envConfig['MOMO_ACCESS_KEY'] || this.configService.get<string>('MOMO_ACCESS_KEY', 'F8BBA842ECF85');
    this.secretKey = envConfig['MOMO_SECRET_KEY'] || this.configService.get<string>('MOMO_SECRET_KEY', 'K951B6PE1waDMi640xX08PD3vg6EkVlz');

    this.logger.log(`Loaded MoMo config: partnerCode=${this.partnerCode}, accessKey=${this.accessKey.substring(0, 5)}***`);
  }

  /**
   * Tạo URL thanh toán MoMo Sandbox
   * Luồng: NestJS → MoMo Sandbox API → Trả về payUrl → Redirect khán giả
   */
  async createPaymentUrl(params: CreatePaymentParams): Promise<PaymentUrlResult> {
    const requestId = `${params.orderId}-${Date.now()}`;
    const requestType = 'payWithMethod';
    const extraData = '';
    const autoCapture = true;
    const lang = 'vi';

    // Tạo rawSignature theo format MoMo yêu cầu
    const rawSignature = [
      `accessKey=${this.accessKey}`,
      `amount=${params.amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${params.ipnUrl}`,
      `orderId=${params.orderId}`,
      `orderInfo=${params.orderInfo}`,
      `partnerCode=${this.partnerCode}`,
      `redirectUrl=${params.returnUrl}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`,
    ].join('&');

    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: params.amount,
      orderId: params.orderId,
      orderInfo: params.orderInfo,
      redirectUrl: params.returnUrl,
      ipnUrl: params.ipnUrl,
      extraData,
      requestType,
      signature,
      lang,
      autoCapture,
    };

    this.logger.log(
      `Creating MoMo payment for order ${params.orderId}, amount: ${params.amount}`,
    );

    // CHEAT CODE ĐỂ TEST CIRCUIT BREAKER (Không cần restart server)
    if (params.orderInfo && params.orderInfo.includes('FAIL_MOMO')) {
      this.logger.error('Cheat code kích hoạt: Giả lập MoMo bị sập!');
      throw new Error('Simulated MoMo API Error for Circuit Breaker Test');
    }

    const response = await this.callMomoApi(requestBody);

    if (response.resultCode !== 0) {
      this.logger.error(
        `MoMo API error: [${response.resultCode}] ${response.message}`,
      );
      throw new Error(`MoMo payment failed: ${response.message}`);
    }

    return {
      payUrl: response.payUrl,
      deeplink: response.deeplink,
      qrCodeUrl: response.qrCodeUrl,
    };
  }

  /**
   * Xác thực chữ ký Webhook từ MoMo
   * MoMo sẽ gọi IPN URL khi thanh toán hoàn tất
   */
  verifyWebhook(payload: Record<string, any>): WebhookVerifyResult {
    const {
      accessKey,
      amount,
      extraData,
      message,
      orderId,
      orderInfo,
      orderType,
      partnerCode,
      payType,
      requestId,
      responseTime,
      resultCode,
      transId,
      signature: receivedSignature,
    } = payload;

    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData}`,
      `message=${message}`,
      `orderId=${orderId}`,
      `orderInfo=${orderInfo}`,
      `orderType=${orderType}`,
      `partnerCode=${partnerCode}`,
      `payType=${payType}`,
      `requestId=${requestId}`,
      `responseTime=${responseTime}`,
      `resultCode=${resultCode}`,
      `transId=${transId}`,
    ].join('&');

    const computedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');

    const isValid = computedSignature === receivedSignature;

    if (!isValid) {
      this.logger.warn(
        `Invalid MoMo webhook signature for order ${orderId}`,
      );
    }

    return {
      isValid,
      orderId: orderId as string,
      transactionId: String(transId),
      amount: Number(amount),
      resultCode: Number(resultCode),
      message: message as string,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private callMomoApi(body: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const bodyStr = JSON.stringify(body);
      const url = new URL(this.endpoint);

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse MoMo response: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        this.logger.error('MoMo HTTP request error:', err);
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy(new Error('MoMo request timed out after 10s'));
      });

      req.write(bodyStr);
      req.end();
    });
  }
}
