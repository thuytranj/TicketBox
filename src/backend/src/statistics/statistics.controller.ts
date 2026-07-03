import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { StatisticsService } from './statistics.service';
import { RevenueQueryDto } from './dto/revenue-query.dto';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZER)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  /**
   * GET /api/v1/statistics/overview
   * Returns system-wide statistics: concerts, orders, revenue, tickets, checkins.
   */
  @Get('overview')
  async getOverview() {
    return this.statisticsService.getOverview();
  }

  /**
   * GET /api/v1/statistics/revenue?period=day&from=2026-06-01&to=2026-06-30
   * Returns revenue time series data for charts.
   */
  @Get('revenue')
  async getRevenueTimeSeries(@Query() query: RevenueQueryDto) {
    return this.statisticsService.getRevenueTimeSeries(
      query.period,
      query.from,
      query.to,
    );
  }

  /**
   * GET /api/v1/statistics/concerts/:id
   * Returns detailed statistics for a specific concert.
   */
  @Get('concerts/:id')
  async getConcertStatistics(@Param('id', ParseUUIDPipe) id: string) {
    return this.statisticsService.getConcertStatistics(id);
  }

  /**
   * GET /api/v1/statistics/concerts/:id/revenue?period=day
   * Returns revenue time series for a specific concert.
   */
  @Get('concerts/:id/revenue')
  async getConcertRevenueTimeSeries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RevenueQueryDto,
  ) {
    return this.statisticsService.getConcertRevenueTimeSeries(
      id,
      query.period,
      query.from,
      query.to,
    );
  }
}
