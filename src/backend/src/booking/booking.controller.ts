import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Request,
  Headers,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SkipThrottle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { RedisRateLimit } from '../common/decorators/redis-rate-limit.decorator';
import { RedisRateLimitGuard } from '../common/guards/redis-rate-limit.guard';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * POST /api/v1/bookings
   *
   * Rate limited to 10 requests per 1 minute (60 seconds) per user ID using Redis sliding window.
   * Idempotency-Key header is required to prevent duplicate orders.
   *
   * Returns 202 Accepted immediately; booking is processed asynchronously.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @SkipThrottle()
  @UseGuards(RedisRateLimitGuard)
  @RedisRateLimit({ limit: 10, ttlMs: 60000 })
  @UseInterceptors(IdempotencyInterceptor)
  async createBooking(
    @Body() dto: CreateBookingDto,
    @Request() req: any,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    const userId: string = req.user.userId;
    return this.bookingService.createBooking(dto, userId, idempotencyKey);
  }

  /**
   * GET /api/v1/bookings/:id
   * Fetch a booking's details (polling status)
   */
  @Get(':id')
  async getBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId: string = req.user.userId;
    return this.bookingService.getBookingById(id, userId);
  }
}
