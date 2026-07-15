import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { MomoGatewayService } from '../gateways/momo.gateway';
import { VnpayGatewayService } from '../gateways/vnpay.gateway';
import { CreatePaymentParams, PaymentUrlResult } from '../gateways/payment-gateway.interface';

/**
 * CircuitBreakerService - Bọc gateway calls trong opossum Circuit Breaker
 *
 * Cấu hình:
 *  - timeout: 8000ms - Nếu gateway không phản hồi trong 8 giây → failure
 *  - errorThresholdPercentage: 50 - Ngắt mạch khi >50% request lỗi trong cửa sổ thời gian
 *  - resetTimeout: 30000ms - Sau 30 giây ở trạng thái OPEN → chuyển HALF-OPEN để thử lại
 *  - volumeThreshold: 5 - Cần tối thiểu 5 request để kích hoạt logic tính toán tỉ lệ lỗi
 *  - rollingCountTimeout: 30000ms - Cửa sổ thời gian đếm request (30 giây)
 */
const CIRCUIT_BREAKER_OPTIONS: CircuitBreaker.Options = {
  timeout: 8000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
  rollingCountTimeout: 30000,
};

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);

  // Một Circuit Breaker riêng cho từng gateway
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private momoBreaker: CircuitBreaker<any[], PaymentUrlResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private vnpayBreaker: CircuitBreaker<any[], PaymentUrlResult>;

  constructor(
    private readonly momoGateway: MomoGatewayService,
    private readonly vnpayGateway: VnpayGatewayService,
  ) {}

  onModuleInit() {
    this.initializeMomoBreaker();
    this.initializeVnpayBreaker();
    this.logger.log('Circuit Breakers initialized for MoMo and VNPAY gateways');
  }

  /**
   * Gọi MoMo qua Circuit Breaker
   */
  async fireMomo(params: CreatePaymentParams): Promise<PaymentUrlResult> {
    try {
      return await this.momoBreaker.fire(params);
    } catch (error) {
      this.logger.error(`MoMo Circuit Breaker error: ${error.message}`);
      throw new ServiceUnavailableException(
        'Cổng thanh toán MoMo hiện đang bảo trì. Vui lòng chọn phương thức khác (VNPAY) hoặc thử lại sau.',
      );
    }
  }

  /**
   * Gọi VNPAY qua Circuit Breaker
   */
  async fireVnpay(params: CreatePaymentParams): Promise<PaymentUrlResult> {
    try {
      return await this.vnpayBreaker.fire(params);
    } catch (error) {
      this.logger.error(`VNPAY Circuit Breaker error: ${error.message}`);
      throw new ServiceUnavailableException(
        'Cổng thanh toán VNPAY hiện đang bảo trì. Vui lòng chọn phương thức khác (MoMo) hoặc thử lại sau.',
      );
    }
  }

  /**
   * Trả về trạng thái hiện tại của mạch (CLOSED/OPEN/HALF-OPEN)
   */
  getStatus(): Record<string, string> {
    return {
      momo: this.getBreakerState(this.momoBreaker),
      vnpay: this.getBreakerState(this.vnpayBreaker),
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private initializeMomoBreaker() {
    this.momoBreaker = new CircuitBreaker(
      (params: CreatePaymentParams) => this.momoGateway.createPaymentUrl(params),
      CIRCUIT_BREAKER_OPTIONS,
    );

    this.registerBreakerEvents(this.momoBreaker, 'MoMo');
  }

  private initializeVnpayBreaker() {
    this.vnpayBreaker = new CircuitBreaker(
      (params: CreatePaymentParams) => this.vnpayGateway.createPaymentUrl(params),
      CIRCUIT_BREAKER_OPTIONS,
    );

    this.registerBreakerEvents(this.vnpayBreaker, 'VNPAY');
  }

  /**
   * Đăng ký các event listener để log chuyển đổi trạng thái mạch
   */
  private registerBreakerEvents(
    breaker: CircuitBreaker,
    gatewayName: string,
  ) {
    breaker.on('open', () => {
      this.logger.warn(
        `[Circuit Breaker - ${gatewayName}] OPEN: Mạch đã ngắt! Đang chặn mọi request tới ${gatewayName}.`,
      );
    });

    breaker.on('halfOpen', () => {
      this.logger.log(
        `[Circuit Breaker - ${gatewayName}] HALF-OPEN: Đang thử nghiệm phục hồi ${gatewayName}...`,
      );
    });

    breaker.on('close', () => {
      this.logger.log(
        `[Circuit Breaker - ${gatewayName}] CLOSED: Mạch đã đóng, ${gatewayName} hoạt động bình thường.`,
      );
    });

    breaker.on('fallback', (result) => {
      this.logger.warn(
        `[Circuit Breaker - ${gatewayName}] FALLBACK triggered. Result: ${JSON.stringify(result)}`,
      );
    });

    breaker.on('timeout', () => {
      this.logger.error(
        `[Circuit Breaker - ${gatewayName}] TIMEOUT: ${gatewayName} không phản hồi trong ${CIRCUIT_BREAKER_OPTIONS.timeout}ms.`,
      );
    });

    breaker.on('reject', () => {
      this.logger.warn(
        `[Circuit Breaker - ${gatewayName}] REJECT: Request bị từ chối vì mạch đang OPEN.`,
      );
    });
  }

  private getBreakerState(breaker: CircuitBreaker): string {
    if (breaker.opened) return 'OPEN';
    if (breaker.halfOpen) return 'HALF-OPEN';
    return 'CLOSED';
  }
}
