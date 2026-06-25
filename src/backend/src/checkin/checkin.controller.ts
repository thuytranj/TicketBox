import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { CheckinDataQueryDto } from './dto/checkin-data-query.dto';
import { CheckinScanDto } from './dto/checkin-scan.dto';
import { CheckinSyncDto } from './dto/checkin-sync.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('checkin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GATE_STAFF, UserRole.ORGANIZER)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  /**
   * GET /api/v1/checkin/data?concertId=<uuid>
   * Downloads all ticket + VIP guest data for offline check-in.
   */
  @Get('data')
  @HttpCode(HttpStatus.OK)
  async getCheckinData(@Query() query: CheckinDataQueryDto) {
    return this.checkinService.getCheckinData(query.concertId);
  }

  /**
   * POST /api/v1/checkin/scan
   * Online QR code scan for check-in.
   */
  @Post('scan')
  @HttpCode(HttpStatus.OK)
  async scanQrCode(@Body() dto: CheckinScanDto, @Request() req: any) {
    const userId: string = req.user.userId;
    return this.checkinService.scanQrCode(dto, userId);
  }

  /**
   * POST /api/v1/checkin/sync
   * Accepts offline check-in logs and queues them for async processing.
   * Returns 202 Accepted immediately.
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncOfflineCheckins(@Body() dto: CheckinSyncDto, @Request() req: any) {
    const userId: string = req.user.userId;
    return this.checkinService.syncOfflineCheckins(dto, userId);
  }
}
