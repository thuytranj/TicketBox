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
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';

@Controller('api/v1/bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * POST /api/v1/bookings
   *
   * Rate limited to 5 requests per 10 seconds per user/IP.
   * Idempotency-Key header is required to prevent duplicate orders.
   *
   * Returns 202 Accepted immediately; booking is processed asynchronously.
   */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: 10000 } })
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
