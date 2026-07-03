import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { Ticket } from '../booking/entities/ticket.entity';
import { CheckinStatus } from '../common/enums/checkin-status.enum';
import { VipGuest } from '../concert/entities/vip-guest.entity';
import { CheckinLog, CheckinLogStatus } from './entities/checkin-log.entity';
import { CHECKIN_SYNC_QUEUE } from './checkin.service';
import { generateUuidV7 } from '../auth/utils/uuid';

interface SyncTaskPayload {
  concertId: string;
  userId: string;
  offlineLogs: Array<{
    qrCodeHash: string;
    deviceId: string;
    scanTime: string;
  }>;
}

@Injectable()
export class CheckinSyncConsumer implements OnModuleInit {
  private readonly logger = new Logger(CheckinSyncConsumer.name);

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(VipGuest)
    private readonly vipGuestRepo: Repository<VipGuest>,
    @InjectRepository(CheckinLog)
    private readonly checkinLogRepo: Repository<CheckinLog>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `Skipped starting checkin sync consumer due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start checkin sync consumer:', err);
    });
  }

  private async startConsuming() {
    this.logger.log(`Starting to consume queue "${CHECKIN_SYNC_QUEUE}"...`);

    await this.rabbitMQService.consume(
      CHECKIN_SYNC_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        let payload: SyncTaskPayload;

        try {
          payload = JSON.parse(msg.content.toString()) as SyncTaskPayload;
        } catch (err) {
          this.logger.error('Failed to parse checkin sync message:', err);
          channel.ack(msg);
          return;
        }

        const { concertId, userId, offlineLogs } = payload;
        this.logger.log(
          `Processing ${offlineLogs.length} offline check-in logs for concert ${concertId}`,
        );

        try {
          for (const log of offlineLogs) {
            await this.processOfflineLog(
              concertId,
              userId,
              log.qrCodeHash,
              log.deviceId,
              new Date(log.scanTime),
            );
          }

          this.logger.log(
            `Successfully processed ${offlineLogs.length} offline logs for concert ${concertId}`,
          );
        } catch (err) {
          this.logger.error(
            `Error processing offline sync for concert ${concertId}:`,
            err,
          );
        } finally {
          channel.ack(msg);
        }
      },
      { noAck: false },
    );
  }

  /**
   * Process a single offline check-in log.
   * Implements "The First Timestamp Wins" conflict resolution:
   *
   * Case 1: Ticket/VIP is not_checked_in → mark as checked_in, log as valid.
   * Case 2: Ticket/VIP is already checked_in:
   *   - If this scan's timestamp is EARLIER than the existing checkedInAt →
   *     override: update checkedInAt, mark old log as invalidated_fraud, save new log as valid.
   *   - If this scan's timestamp is LATER or equal → save log as invalidated_fraud (late arrival).
   */
  private async processOfflineLog(
    concertId: string,
    userId: string,
    qrCodeHash: string,
    deviceId: string,
    scanTime: Date,
  ) {
    // Try regular ticket first
    const ticket = await this.ticketRepo
      .createQueryBuilder('ticket')
      .innerJoin('ticket.order', 'order')
      .where('ticket.qrCodeHash = :qrCodeHash', { qrCodeHash })
      .andWhere('order.concertId = :concertId', { concertId })
      .andWhere('order.status = :orderStatus', { orderStatus: 'paid' })
      .getOne();

    if (ticket) {
      await this.processTicketCheckin(ticket, userId, deviceId, scanTime);
      return;
    }

    // Try VIP guest
    const vipGuest = await this.vipGuestRepo.findOne({
      where: { qrCodeHash, concertId },
    });

    if (vipGuest) {
      await this.processVipGuestCheckin(vipGuest, userId, deviceId, scanTime);
      return;
    }

    // Not found — log as invalid (no DB record to update)
    this.logger.warn(
      `Offline sync: QR code "${qrCodeHash}" not found for concert ${concertId}. Skipping.`,
    );
  }

  private async processTicketCheckin(
    ticket: Ticket,
    userId: string,
    deviceId: string,
    scanTime: Date,
  ) {
    await this.dataSource.transaction(async (manager) => {
      if (ticket.checkinStatus === CheckinStatus.NOT_CHECKED_IN) {
        // Case 1: First check-in
        await manager.update(Ticket, ticket.id, {
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: scanTime,
        });

        const log = manager.create(CheckinLog, {
          id: generateUuidV7(),
          ticketId: ticket.id,
          vipGuestId: null,
          checkedBy: userId,
          scanTime,
          isOffline: true,
          deviceId,
          status: CheckinLogStatus.VALID,
        });
        await manager.save(CheckinLog, log);

        this.logger.log(
          `Ticket ${ticket.id} checked in via offline sync (first check-in)`,
        );
      } else {
        // Case 2: Already checked in — apply First Timestamp Wins
        const existingCheckedInAt = ticket.checkedInAt;
        if (!existingCheckedInAt || scanTime < existingCheckedInAt) {
          // This scan is EARLIER → override
          this.logger.warn(
            `Ticket ${ticket.id}: offline scan (${scanTime.toISOString()}) is earlier than existing (${existingCheckedInAt ? existingCheckedInAt.toISOString() : 'null'}). Overriding with First Timestamp Wins.`,
          );

          // Invalidate the previous log(s)
          await manager
            .createQueryBuilder()
            .update(CheckinLog)
            .set({ status: CheckinLogStatus.INVALIDATED_FRAUD })
            .where('ticketId = :ticketId', { ticketId: ticket.id })
            .andWhere('status = :validStatus', {
              validStatus: CheckinLogStatus.VALID,
            })
            .execute();

          // Update ticket with earlier timestamp
          await manager.update(Ticket, ticket.id, {
            checkedInAt: scanTime,
          });

          // Save new log as valid
          const log = manager.create(CheckinLog, {
            id: generateUuidV7(),
            ticketId: ticket.id,
            vipGuestId: null,
            checkedBy: userId,
            scanTime,
            isOffline: true,
            deviceId,
            status: CheckinLogStatus.VALID,
          });
          await manager.save(CheckinLog, log);
        } else {
          // This scan is LATER → mark as fraud
          this.logger.warn(
            `Ticket ${ticket.id}: duplicate offline scan detected (${scanTime.toISOString()} >= ${existingCheckedInAt.toISOString()}). Marking as fraud.`,
          );

          const log = manager.create(CheckinLog, {
            id: generateUuidV7(),
            ticketId: ticket.id,
            vipGuestId: null,
            checkedBy: userId,
            scanTime,
            isOffline: true,
            deviceId,
            status: CheckinLogStatus.INVALIDATED_FRAUD,
          });
          await manager.save(CheckinLog, log);
        }
      }
    });
  }

  private async processVipGuestCheckin(
    vipGuest: VipGuest,
    userId: string,
    deviceId: string,
    scanTime: Date,
  ) {
    await this.dataSource.transaction(async (manager) => {
      if (vipGuest.checkinStatus === CheckinStatus.NOT_CHECKED_IN) {
        // Case 1: First check-in
        await manager.update(VipGuest, vipGuest.id, {
          checkinStatus: CheckinStatus.CHECKED_IN,
          checkedInAt: scanTime,
        });

        const log = manager.create(CheckinLog, {
          id: generateUuidV7(),
          ticketId: null,
          vipGuestId: vipGuest.id,
          checkedBy: userId,
          scanTime,
          isOffline: true,
          deviceId,
          status: CheckinLogStatus.VALID,
        });
        await manager.save(CheckinLog, log);

        this.logger.log(
          `VIP Guest ${vipGuest.id} checked in via offline sync (first check-in)`,
        );
      } else {
        // Case 2: Already checked in — apply First Timestamp Wins
        const existingCheckedInAt = vipGuest.checkedInAt;
        if (!existingCheckedInAt || scanTime < existingCheckedInAt) {
          this.logger.warn(
            `VIP Guest ${vipGuest.id}: offline scan (${scanTime.toISOString()}) is earlier. Overriding.`,
          );

          await manager
            .createQueryBuilder()
            .update(CheckinLog)
            .set({ status: CheckinLogStatus.INVALIDATED_FRAUD })
            .where('vipGuestId = :vipGuestId', { vipGuestId: vipGuest.id })
            .andWhere('status = :validStatus', {
              validStatus: CheckinLogStatus.VALID,
            })
            .execute();

          await manager.update(VipGuest, vipGuest.id, {
            checkedInAt: scanTime,
          });

          const log = manager.create(CheckinLog, {
            id: generateUuidV7(),
            ticketId: null,
            vipGuestId: vipGuest.id,
            checkedBy: userId,
            scanTime,
            isOffline: true,
            deviceId,
            status: CheckinLogStatus.VALID,
          });
          await manager.save(CheckinLog, log);
        } else {
          this.logger.warn(
            `VIP Guest ${vipGuest.id}: duplicate offline scan (${scanTime.toISOString()}). Marking as fraud.`,
          );

          const log = manager.create(CheckinLog, {
            id: generateUuidV7(),
            ticketId: null,
            vipGuestId: vipGuest.id,
            checkedBy: userId,
            scanTime,
            isOffline: true,
            deviceId,
            status: CheckinLogStatus.INVALIDATED_FRAUD,
          });
          await manager.save(CheckinLog, log);
        }
      }
    });
  }
}
