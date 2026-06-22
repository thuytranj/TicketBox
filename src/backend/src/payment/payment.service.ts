import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Order, OrderStatus } from '../booking/entities/order.entity';
import { Ticket } from '../booking/entities/ticket.entity';
import { Payment, PaymentGateway, PaymentStatus } from './entities/payment.entity';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { MomoGatewayService } from './gateways/momo.gateway';
import { VnpayGatewayService } from './gateways/vnpay.gateway';
import { RedisService } from '../common/redis/redis.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

export const PAYMENT_SUCCESS_QUEUE = 'payment_success';
export const PAYMENT_KEY_TTL = 600; // 10 phút (giây)

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly momoGateway: MomoGatewayService,
    private readonly vnpayGateway: VnpayGatewayService,
    private readonly redisService: RedisService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Khởi tạo thanh toán MoMo
   * Luồng: Validate order → Tạo Payment record (PENDING) → Circuit Breaker → MoMo Sandbox → Trả payUrl
   */
  async initiateMomoPayment(
    dto: InitiatePaymentDto,
    userId: string,
    ipAddress: string,
  ) {
    const order = await this.validateOrderForPayment(dto.orderId, userId);

    const returnUrl = this.configService.get<string>(
      'MOMO_REDIRECT_URL',
      'http://localhost:3001/payment/callback/momo',
    );
    const ipnUrl = this.configService.get<string>(
      'MOMO_IPN_URL',
      'http://localhost:3000/api/v1/payments/momo/webhook',
    );

    const payment = await this.createPendingPaymentRecord(
      order,
      PaymentGateway.MOMO,
    );

    // Gọi MoMo qua Circuit Breaker (opossum)
    const result = await this.circuitBreaker.fireMomo({
      orderId: order.id,
      amount: order.totalAmount,
      orderInfo: dto.orderInfo || `Thanh toán vé concert - Đơn hàng ${order.id}`,
      returnUrl,
      ipnUrl,
      ipAddress,
    });

    // Lưu payUrl vào payment record
    await this.paymentRepo.update(payment.id, {
      payUrl: result.payUrl,
    });

    this.logger.log(
      `MoMo payment initiated for order ${order.id} by user ${userId}`,
    );

    return {
      payUrl: result.payUrl,
      deeplink: result.deeplink,
      qrCodeUrl: result.qrCodeUrl,
      paymentId: payment.id,
    };
  }

  /**
   * Khởi tạo thanh toán VNPAY
   */
  async initiateVnpayPayment(
    dto: InitiatePaymentDto,
    userId: string,
    ipAddress: string,
  ) {
    const order = await this.validateOrderForPayment(dto.orderId, userId);

    const returnUrl = this.configService.get<string>(
      'VNPAY_RETURN_URL',
      'http://localhost:3001/payment/callback/vnpay',
    );
    const ipnUrl = this.configService.get<string>(
      'VNPAY_IPN_URL',
      'http://localhost:3000/api/v1/payments/vnpay/webhook',
    );

    const payment = await this.createPendingPaymentRecord(
      order,
      PaymentGateway.VNPAY,
    );

    // Gọi VNPAY qua Circuit Breaker (opossum)
    const result = await this.circuitBreaker.fireVnpay({
      orderId: order.id,
      amount: order.totalAmount,
      orderInfo: dto.orderInfo || `Thanh toán vé concert - Đơn hàng ${order.id}`,
      returnUrl,
      ipnUrl,
      ipAddress,
    });

    await this.paymentRepo.update(payment.id, {
      payUrl: result.payUrl,
    });

    this.logger.log(
      `VNPAY payment initiated for order ${order.id} by user ${userId}`,
    );

    return {
      payUrl: result.payUrl,
      paymentId: payment.id,
    };
  }

  /**
   * Xử lý Webhook IPN từ MoMo
   * MoMo gọi về URL này sau khi khán giả thanh toán xong
   */
  async handleMomoWebhook(payload: Record<string, any>): Promise<{ message: string }> {
    const verify = this.momoGateway.verifyWebhook(payload);

    if (!verify.isValid) {
      this.logger.warn(
        `Invalid MoMo webhook signature for order ${verify.orderId}`,
      );
      return { message: 'invalid signature' };
    }

    // MoMo resultCode = 0 là thành công
    if (Number(verify.resultCode) === 0) {
      await this.processSuccessfulPayment(
        verify.orderId,
        verify.transactionId,
        verify.amount,
        PaymentGateway.MOMO,
        payload,
      );
    } else {
      await this.processFailedPayment(
        verify.orderId,
        PaymentGateway.MOMO,
        verify.resultCode,
        payload,
      );
    }

    return { message: 'received' };
  }

  /**
   * Xử lý IPN từ VNPAY
   * VNPAY gọi về URL này sau khi khán giả thanh toán xong
   */
  async handleVnpayWebhook(payload: Record<string, any>): Promise<{ RspCode: string; Message: string }> {
    const verify = this.vnpayGateway.verifyWebhook(payload);

    if (!verify.isValid) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    // Kiểm tra amount khớp với DB
    const order = await this.orderRepo.findOne({
      where: { id: verify.orderId },
    });

    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (Math.abs(order.totalAmount - verify.amount) > 1) {
      this.logger.error(
        `Amount mismatch for order ${verify.orderId}: expected ${order.totalAmount}, got ${verify.amount}`,
      );
      return { RspCode: '04', Message: 'Amount mismatch' };
    }

    // VNPAY responseCode = '00' là thành công
    if (verify.resultCode === '00') {
      await this.processSuccessfulPayment(
        verify.orderId,
        verify.transactionId,
        verify.amount,
        PaymentGateway.VNPAY,
        payload,
      );
    } else {
      await this.processFailedPayment(
        verify.orderId,
        PaymentGateway.VNPAY,
        verify.resultCode,
        payload,
      );
    }

    // VNPAY yêu cầu trả về JSON này để xác nhận đã nhận IPN
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  /**
   * Lấy trạng thái thanh toán theo orderId
   */
  async getPaymentStatus(orderId: string, userId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');

    const payments = await this.paymentRepo.find({ where: { orderId } });

    return {
      orderId,
      orderStatus: order.status,
      payments: payments.map((p) => ({
        id: p.id,
        gateway: p.gateway,
        status: p.status,
        transactionId: p.transactionId,
        amount: p.amount,
        payUrl: p.payUrl,
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Trả về trạng thái Circuit Breaker của từng gateway
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus();
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private async validateOrderForPayment(orderId: string, userId: string): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Order ${orderId} is not in PENDING state (current: ${order.status})`,
      );
    }

    return order;
  }

  private async createPendingPaymentRecord(
    order: Order,
    gateway: PaymentGateway,
  ): Promise<Payment> {
    const payment = this.paymentRepo.create({
      orderId: order.id,
      gateway,
      amount: order.totalAmount,
      status: PaymentStatus.PENDING,
    });
    return this.paymentRepo.save(payment);
  }

  /**
   * Xử lý thanh toán thành công (idempotent):
   * 1. Update Payment record → SUCCESS
   * 2. Update Order → PAID trong DB
   * 3. Cập nhật Redis idempotency key → SUCCESS
   * 4. Đẩy event vào RabbitMQ để Worker activate tickets
   */
  private async processSuccessfulPayment(
    orderId: string,
    transactionId: string,
    amount: number,
    gateway: PaymentGateway,
    rawResponse: Record<string, any>,
  ) {
    // Kiểm tra idempotent: tránh xử lý 2 lần nếu webhook gọi 2 lần
    const webhookKey = `payment:webhook:${orderId}`;
    const alreadyProcessed = await this.redisService.set(
      webhookKey,
      'processed',
      'EX',
      86400, // 24 giờ
      'NX',
    );

    if (!alreadyProcessed) {
      this.logger.warn(
        `Webhook for order ${orderId} already processed. Skipping.`,
      );
      return;
    }

    // Cập nhật Payment record
    await this.paymentRepo.update(
      { orderId, gateway },
      {
        status: PaymentStatus.SUCCESS,
        transactionId,
        rawResponse,
      },
    );

    // Cập nhật Order → PAID
    await this.orderRepo.update({ id: orderId }, { status: OrderStatus.PAID });

    this.logger.log(
      `Payment SUCCESS: order=${orderId}, gateway=${gateway}, txn=${transactionId}, amount=${amount}`,
    );

    // Đẩy event vào RabbitMQ để Worker activate tickets
    await this.rabbitMQService.sendToQueue(
      PAYMENT_SUCCESS_QUEUE,
      {
        orderId,
        transactionId,
        amount,
        gateway,
      },
      { persistent: true },
    );
  }

  private async processFailedPayment(
    orderId: string,
    gateway: PaymentGateway,
    resultCode: string | number,
    rawResponse: Record<string, any>,
  ) {
    await this.paymentRepo.update(
      { orderId, gateway },
      {
        status: PaymentStatus.FAILED,
        rawResponse,
      },
    );

    this.logger.warn(
      `Payment FAILED: order=${orderId}, gateway=${gateway}, resultCode=${resultCode}`,
    );
  }
}
