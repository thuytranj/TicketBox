import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../booking/entities/order.entity';
import { TicketType } from '../concert/entities/ticket-type.entity';
import { Concert } from '../concert/entities/concert.entity';
import { CheckinLog, CheckinLogStatus } from '../checkin/entities/checkin-log.entity';
import { RedisService } from '../common/redis/redis.service';

const CACHE_TTL_SECONDS = 30;
const CACHE_PREFIX = 'stats:';

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepo: Repository<TicketType>,
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    @InjectRepository(CheckinLog)
    private readonly checkinLogRepo: Repository<CheckinLog>,
    private readonly redisService: RedisService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Try to get cached result from Redis. If miss, run the query function,
   * store result in Redis with TTL, and return it.
   */
  private async withCache<T>(cacheKey: string, queryFn: () => Promise<T>): Promise<T> {
    const fullKey = `${CACHE_PREFIX}${cacheKey}`;

    try {
      const cached = await this.redisService.get(fullKey);
      if (cached) {
        this.logger.debug(`Cache HIT: ${fullKey}`);
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      // Fail-open: if Redis is down, just run the query
      this.logger.warn(`Redis cache read failed for ${fullKey}, falling back to DB`, err);
    }

    const result = await queryFn();

    try {
      await this.redisService.set(fullKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
      this.logger.debug(`Cache SET: ${fullKey} (TTL=${CACHE_TTL_SECONDS}s)`);
    } catch (err) {
      this.logger.warn(`Redis cache write failed for ${fullKey}`, err);
    }

    return result;
  }

  // ─── 1. Overview ──────────────────────────────────────────────────────────

  async getOverview() {
    return this.withCache('overview', async () => {
      // Concerts by status
      const concertCounts = await this.concertRepo
        .createQueryBuilder('c')
        .select('c.status', 'status')
        .addSelect('COUNT(c.id)', 'count')
        .groupBy('c.status')
        .getRawMany();

      const concertMap: Record<string, number> = {};
      let totalConcerts = 0;
      for (const row of concertCounts) {
        const count = parseInt(row.count, 10);
        concertMap[row.status] = count;
        totalConcerts += count;
      }

      // Orders by status
      const orderCounts = await this.orderRepo
        .createQueryBuilder('o')
        .select('o.status', 'status')
        .addSelect('COUNT(o.id)', 'count')
        .groupBy('o.status')
        .getRawMany();

      const orderMap: Record<string, number> = {};
      let totalOrders = 0;
      for (const row of orderCounts) {
        const count = parseInt(row.count, 10);
        orderMap[row.status] = count;
        totalOrders += count;
      }

      // Total revenue (paid orders only)
      const revenueResult = await this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_amount), 0)', 'totalRevenue')
        .where('o.status = :status', { status: OrderStatus.PAID })
        .getRawOne();

      const totalRevenue = parseFloat(revenueResult.totalRevenue);
      const paidCount = orderMap[OrderStatus.PAID] || 0;
      const averageOrderValue = paidCount > 0 ? totalRevenue / paidCount : 0;

      // Tickets summary (from ticket_types)
      const ticketResult = await this.ticketTypeRepo
        .createQueryBuilder('tt')
        .select('COALESCE(SUM(tt.total_quantity), 0)', 'totalIssued')
        .addSelect('COALESCE(SUM(tt.total_quantity - tt.available_quantity), 0)', 'totalSold')
        .getRawOne();

      const totalIssued = parseInt(ticketResult.totalIssued, 10);
      const totalSold = parseInt(ticketResult.totalSold, 10);
      const fillRate = totalIssued > 0 ? Math.round((totalSold / totalIssued) * 10000) / 100 : 0;

      // Checkin count
      const checkinResult = await this.checkinLogRepo
        .createQueryBuilder('cl')
        .select('COUNT(cl.id)', 'totalCheckins')
        .where('cl.status = :status', { status: CheckinLogStatus.VALID })
        .getRawOne();

      const totalCheckins = parseInt(checkinResult.totalCheckins, 10);
      const checkinRate = totalSold > 0 ? Math.round((totalCheckins / totalSold) * 10000) / 100 : 0;

      return {
        concerts: {
          total: totalConcerts,
          active: concertMap['active'] || 0,
          draft: concertMap['draft'] || 0,
          cancelled: concertMap['cancelled'] || 0,
        },
        orders: {
          total: totalOrders,
          paid: orderMap[OrderStatus.PAID] || 0,
          pending: orderMap[OrderStatus.PENDING] || 0,
          expired: orderMap[OrderStatus.EXPIRED] || 0,
          cancelled: orderMap[OrderStatus.CANCELLED] || 0,
        },
        revenue: {
          totalRevenue,
          averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        },
        tickets: {
          totalIssued,
          totalSold,
          fillRate,
        },
        checkins: {
          totalCheckins,
          checkinRate,
        },
      };
    });
  }

  // ─── 2. Revenue Time Series ───────────────────────────────────────────────

  async getRevenueTimeSeries(
    period: 'day' | 'week' | 'month' = 'day',
    from?: string,
    to?: string,
  ) {
    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const cacheKey = `revenue:${period}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;

    return this.withCache(cacheKey, async () => {
      const data = await this.orderRepo
        .createQueryBuilder('o')
        .select(`DATE_TRUNC(:period, o.created_at)`, 'date')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .addSelect('COUNT(o.id)', 'orderCount')
        .where('o.status = :status', { status: OrderStatus.PAID })
        .andWhere('o.created_at >= :from', { from: dateFrom })
        .andWhere('o.created_at <= :to', { to: dateTo })
        .setParameter('period', period)
        .groupBy(`DATE_TRUNC(:period, o.created_at)`)
        .orderBy(`"date"`, 'ASC')
        .getRawMany();

      return {
        period,
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        data: data.map((row) => ({
          date: row.date,
          revenue: parseFloat(row.revenue),
          orderCount: parseInt(row.orderCount, 10),
        })),
      };
    });
  }

  // ─── 3. Concert Detail Statistics ─────────────────────────────────────────

  async getConcertStatistics(concertId: string) {
    const cacheKey = `concert:${concertId}`;

    return this.withCache(cacheKey, async () => {
      // Verify concert exists
      const concert = await this.concertRepo.findOne({
        where: { id: concertId },
        select: ['id', 'title', 'status', 'startTime'],
      });

      if (!concert) {
        throw new NotFoundException(`Concert with ID ${concertId} not found`);
      }

      // Revenue for this concert
      const revenueResult = await this.orderRepo
        .createQueryBuilder('o')
        .select('COALESCE(SUM(o.total_amount), 0)', 'totalRevenue')
        .addSelect('COUNT(o.id)', 'paidOrderCount')
        .where('o.concert_id = :concertId', { concertId })
        .andWhere('o.status = :status', { status: OrderStatus.PAID })
        .getRawOne();

      // Ticket types breakdown
      const ticketTypes = await this.ticketTypeRepo
        .createQueryBuilder('tt')
        .select([
          'tt.name AS name',
          'tt.price AS price',
          'tt.total_quantity AS "totalQuantity"',
          'tt.available_quantity AS "availableQuantity"',
          '(tt.total_quantity - tt.available_quantity) AS "soldQuantity"',
          '(tt.price * (tt.total_quantity - tt.available_quantity)) AS revenue',
        ])
        .where('tt.concert_id = :concertId', { concertId })
        .getRawMany();

      // Ticket checkins (join checkin_logs -> tickets -> orders)
      const ticketCheckinResult = await this.checkinLogRepo
        .createQueryBuilder('cl')
        .innerJoin('cl.ticket', 't')
        .innerJoin('t.order', 'o')
        .select('COUNT(cl.id)', 'ticketCheckins')
        .where('o.concert_id = :concertId', { concertId })
        .andWhere('cl.status = :status', { status: CheckinLogStatus.VALID })
        .getRawOne();

      // VIP guest checkins
      const vipCheckinResult = await this.checkinLogRepo
        .createQueryBuilder('cl')
        .innerJoin('cl.vipGuest', 'vg')
        .select('COUNT(cl.id)', 'vipGuestCheckins')
        .where('vg.concert_id = :concertId', { concertId })
        .andWhere('cl.status = :status', { status: CheckinLogStatus.VALID })
        .getRawOne();

      const ticketCheckins = parseInt(ticketCheckinResult.ticketCheckins, 10);
      const vipGuestCheckins = parseInt(vipCheckinResult.vipGuestCheckins, 10);

      return {
        concert: {
          id: concert.id,
          title: concert.title,
          status: concert.status,
          startTime: concert.startTime,
        },
        revenue: {
          totalRevenue: parseFloat(revenueResult.totalRevenue),
          paidOrderCount: parseInt(revenueResult.paidOrderCount, 10),
        },
        ticketTypes: ticketTypes.map((tt) => ({
          name: tt.name,
          price: parseFloat(tt.price),
          totalQuantity: parseInt(tt.totalQuantity, 10),
          availableQuantity: parseInt(tt.availableQuantity, 10),
          soldQuantity: parseInt(tt.soldQuantity, 10),
          revenue: parseFloat(tt.revenue),
        })),
        checkins: {
          ticketCheckins,
          vipGuestCheckins,
          totalCheckins: ticketCheckins + vipGuestCheckins,
        },
      };
    });
  }

  // ─── 4. Concert Revenue Time Series ───────────────────────────────────────

  async getConcertRevenueTimeSeries(
    concertId: string,
    period: 'day' | 'week' | 'month' = 'day',
    from?: string,
    to?: string,
  ) {
    // Verify concert exists
    const exists = await this.concertRepo.findOne({
      where: { id: concertId },
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException(`Concert with ID ${concertId} not found`);
    }

    const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = to ? new Date(to) : new Date();

    const cacheKey = `concert:${concertId}:revenue:${period}:${dateFrom.toISOString()}:${dateTo.toISOString()}`;

    return this.withCache(cacheKey, async () => {
      const data = await this.orderRepo
        .createQueryBuilder('o')
        .select(`DATE_TRUNC(:period, o.created_at)`, 'date')
        .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
        .addSelect('COUNT(o.id)', 'orderCount')
        .where('o.concert_id = :concertId', { concertId })
        .andWhere('o.status = :status', { status: OrderStatus.PAID })
        .andWhere('o.created_at >= :from', { from: dateFrom })
        .andWhere('o.created_at <= :to', { to: dateTo })
        .setParameter('period', period)
        .groupBy(`DATE_TRUNC(:period, o.created_at)`)
        .orderBy(`"date"`, 'ASC')
        .getRawMany();

      return {
        concertId,
        period,
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        data: data.map((row) => ({
          date: row.date,
          revenue: parseFloat(row.revenue),
          orderCount: parseInt(row.orderCount, 10),
        })),
      };
    });
  }
}
