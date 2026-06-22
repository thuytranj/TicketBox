import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  Request,
  Req,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { PaymentService } from './payment.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /api/v1/payments/momo
   * Khởi tạo thanh toán qua MoMo Sandbox.
   * Yêu cầu xác thực JWT + Idempotency-Key header.
   * Circuit Breaker sẽ tự động bảo vệ nếu MoMo sandbox lỗi.
   */
  @Post('momo')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 10000 } })
  @UseInterceptors(IdempotencyInterceptor)
  async initiateMomo(
    @Body() dto: InitiatePaymentDto,
    @Request() req: any,
    @Req() request: any,
  ) {
    const userId: string = req.user.userId;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    return this.paymentService.initiateMomoPayment(dto, userId, ipAddress);
  }

  /**
   * POST /api/v1/payments/vnpay
   * Khởi tạo thanh toán qua VNPAY Sandbox.
   */
  @Post('vnpay')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 10000 } })
  @UseInterceptors(IdempotencyInterceptor)
  async initiateVnpay(
    @Body() dto: InitiatePaymentDto,
    @Request() req: any,
    @Req() request: any,
  ) {
    const userId: string = req.user.userId;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || '127.0.0.1';
    return this.paymentService.initiateVnpayPayment(dto, userId, ipAddress);
  }

  /**
   * POST /api/v1/payments/momo/webhook
   * IPN Webhook từ MoMo gọi về để thông báo kết quả thanh toán.
   * KHÔNG yêu cầu JWT (MoMo gọi trực tiếp về server).
   * Bảo mật bằng chữ ký HMAC SHA256 trong payload.
   */
  @Get('momo/webhook')
  @Post('momo/webhook')
  @HttpCode(HttpStatus.OK)
  async momoWebhook(@Body() payload: Record<string, any>, @Query() query: Record<string, any>) {
    const fullPayload = { ...query, ...payload };
    return this.paymentService.handleMomoWebhook(fullPayload);
  }

  /**
   * POST /api/v1/payments/vnpay/webhook
   * IPN từ VNPAY gọi về để thông báo kết quả giao dịch.
   * VNPAY yêu cầu trả về JSON { RspCode: '00', Message: 'Confirm Success' }.
   */
  @Get('vnpay/webhook')
  @Post('vnpay/webhook')
  @HttpCode(HttpStatus.OK)
  async vnpayWebhook(@Body() payload: Record<string, any>, @Query() query: Record<string, any>) {
    // VNPAY có thể gửi qua cả body lẫn query string tùy cấu hình
    const fullPayload = { ...query, ...payload };
    return this.paymentService.handleVnpayWebhook(fullPayload);
  }

  /**
   * GET /api/v1/payments/:orderId
   * Lấy trạng thái thanh toán của một đơn hàng.
   */
  @Get(':orderId')
  @UseGuards(JwtAuthGuard)
  async getStatus(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Request() req: any,
  ) {
    return this.paymentService.getPaymentStatus(orderId, req.user.userId);
  }

  /**
   * GET /api/v1/payments/circuit-breaker/status
   * Trả về trạng thái Circuit Breaker của từng gateway (CLOSED/OPEN/HALF-OPEN).
   * Endpoint nội bộ để monitoring.
   */
  @Get('circuit-breaker/status')
  @UseGuards(JwtAuthGuard)
  getCircuitBreakerStatus() {
    return this.paymentService.getCircuitBreakerStatus();
  }
}
