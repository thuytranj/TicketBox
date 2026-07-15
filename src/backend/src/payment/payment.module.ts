import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentConsumer } from './payment.consumer';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { MomoGatewayService } from './gateways/momo.gateway';
import { VnpayGatewayService } from './gateways/vnpay.gateway';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { Payment } from './entities/payment.entity';
import { Order } from '../booking/entities/order.entity';
import { Ticket } from '../booking/entities/ticket.entity';
import { User } from '../auth/entities/user.entity';
import { Concert } from '../concert/entities/concert.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Order, Ticket, User, Concert, TicketType]),
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    PaymentConsumer,
    CircuitBreakerService,
    MomoGatewayService,
    VnpayGatewayService,
    IdempotencyInterceptor,
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
