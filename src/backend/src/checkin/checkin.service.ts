import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { Ticket } from '../booking/entities/ticket.entity';
import { CheckinStatus } from '../common/enums/checkin-status.enum';
import { VipGuest } from '../concert/entities/vip-guest.entity';
import { Concert } from '../concert/entities/concert.entity';
import { CheckinLog, CheckinLogStatus } from './entities/checkin-log.entity';
import { CheckinScanDto } from './dto/checkin-scan.dto';
import { CheckinSyncDto } from './dto/checkin-sync.dto';
import { generateUuidV7 } from '../auth/utils/uuid';

export const CHECKIN_SYNC_QUEUE = 'checkin.sync.queue';

@Injectable()
export class CheckinService {
  private readonly logger = new Logger(CheckinService.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(VipGuest)
    private readonly vipGuestRepo: Repository<VipGuest>,
    @InjectRepository(Concert)
    private readonly concertRepo: Repository<Concert>,
    @InjectRepository(CheckinLog)
    private readonly checkinLogRepo: Repository<CheckinLog>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * GET /checkin/data
   * Load all valid tickets + VIP guests for a concert (for offline pre-sync).
   */
  async getCheckinData(concertId: string) {
    // Validate concert exists
    const concert = await this.concertRepo.findOne({
      where: { id: concertId },
    });
    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    // Fetch paid tickets with their ticket type (for zoneId)
    const tickets = await this.ticketRepo
      .createQueryBuilder('ticket')
      .innerJoin('ticket.order', 'order')
      .innerJoin('ticket.ticketType', 'ticketType')
      .select([
        'ticket.id',
        'ticket.qrCodeHash',
        'ticket.checkinStatus',
        'ticketType.name',
      ])
      .where('order.concertId = :concertId', { concertId })
      .andWhere('order.status = :orderStatus', { orderStatus: 'paid' })
      .andWhere('ticket.status = :ticketStatus', { ticketStatus: 'active' })
      .getMany();

    // Fetch VIP guests
    const vipGuests = await this.vipGuestRepo.find({
      where: { concertId, status: 'active' as any },
      select: ['id', 'qrCodeHash', 'checkinStatus'],
    });

    return {
      concertId,
      tickets: tickets.map((t) => ({
        id: t.id,
        qrCodeHash: t.qrCodeHash,
        checkinStatus: t.checkinStatus,
        zoneId: t.ticketType?.name || null,
      })),
      vipGuests: vipGuests.map((v) => ({
        id: v.id,
        qrCodeHash: v.qrCodeHash,
        checkinStatus: v.checkinStatus,
      })),
    };
  }

  /**
   * POST /checkin/scan
   * Online QR code scan — processes check-in synchronously.
   */
  async scanQrCode(dto: CheckinScanDto, userId: string) {
    const { concertId, qrCodeHash, deviceId, scanTime } = dto;
    const actualScanTime = scanTime ? new Date(scanTime) : new Date();

    // Try to find a regular ticket first
    const ticket = await this.ticketRepo
      .createQueryBuilder('ticket')
      .innerJoin('ticket.order', 'order')
      .where('ticket.qrCodeHash = :qrCodeHash', { qrCodeHash })
      .andWhere('order.concertId = :concertId', { concertId })
      .andWhere('order.status = :orderStatus', { orderStatus: 'paid' })
      .getOne();

    if (ticket) {
      // Check duplicate
      if (ticket.checkinStatus === CheckinStatus.CHECKED_IN) {
        throw new BadRequestException({
          success: false,
          code: 'ALREADY_USED',
          status: 'ALREADY_USED',
          message: 'Ticket has already been used',
          error: 'Duplicate Check-in',
          statusCode: 400,
        });
      }

      // Perform check-in within a transaction
      await this.dataSource.transaction(async (manager) => {
        await manager.update(Ticket, ticket.id, {
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: actualScanTime,
        });

        const log = manager.create(CheckinLog, {
          id: generateUuidV7(),
          ticketId: ticket.id,
          vipGuestId: null,
          checkedBy: userId,
          scanTime: actualScanTime,
          isOffline: false,
          deviceId,
          status: CheckinLogStatus.VALID,
        });
        await manager.save(CheckinLog, log);
      });

      return {
        success: true,
        message: 'Check-in successful',
        data: {
          type: 'regular_ticket',
          ticketId: ticket.id,
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: actualScanTime.toISOString(),
        },
      };
    }

    // Try VIP guest
    const vipGuest = await this.vipGuestRepo.findOne({
      where: { qrCodeHash, concertId },
    });

    if (vipGuest) {
      if (vipGuest.checkinStatus === CheckinStatus.CHECKED_IN) {
        throw new BadRequestException({
          success: false,
          code: 'ALREADY_USED',
          status: 'ALREADY_USED',
          message: 'Ticket has already been used',
          error: 'Duplicate Check-in',
          statusCode: 400,
        });
      }

      await this.dataSource.transaction(async (manager) => {
        await manager.update(VipGuest, vipGuest.id, {
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: actualScanTime,
        });

        const log = manager.create(CheckinLog, {
          id: generateUuidV7(),
          ticketId: null,
          vipGuestId: vipGuest.id,
          checkedBy: userId,
          scanTime: actualScanTime,
          isOffline: false,
          deviceId,
          status: CheckinLogStatus.VALID,
        });
        await manager.save(CheckinLog, log);
      });

      return {
        success: true,
        message: 'Check-in successful',
        data: {
          type: 'vip_guest',
          ticketId: vipGuest.id,
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: actualScanTime.toISOString(),
        },
      };
    }

    // Not found
    throw new NotFoundException(
      'Ticket or VIP guest not found for this concert',
    );
  }

  /**
   * POST /checkin/sync
   * Accepts offline check-in logs and publishes them to RabbitMQ for async processing.
   * Returns 202 Accepted immediately.
   */
  async syncOfflineCheckins(dto: CheckinSyncDto, userId: string) {
    const { concertId, offlineLogs } = dto;

    // Validate concert exists
    const concert = await this.concertRepo.findOne({
      where: { id: concertId },
    });
    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    // Publish to RabbitMQ for sequential processing by the worker
    await this.rabbitMQService.sendToQueue(CHECKIN_SYNC_QUEUE, {
      concertId,
      userId,
      offlineLogs,
    });

    this.logger.log(
      `Published ${offlineLogs.length} offline check-in logs for concert ${concertId} to queue`,
    );

    return {
      success: true,
      message: 'Offline check-in sync accepted for processing',
      total: offlineLogs.length,
    };
  }
}
