import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Readable } from 'stream';
import csv from 'csv-parser';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as crypto from 'crypto';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { Concert } from './entities/concert.entity';
import { VipGuest, VipGuestStatus } from './entities/vip-guest.entity';
import { VipGuestImport, VipGuestImportStatus } from './entities/vip-guest-import.entity';
import { VipGuestRowDto } from './dto/import-vip-guests.dto';
import { VIP_GUEST_IMPORT_QUEUE } from './concert.service';
import { generateUuidV7 } from '../auth/utils/uuid';

interface ImportTaskPayload {
  jobId: string;
  concertId: string;
  fileUrl: string;
}

@Injectable()
export class VipGuestConsumer implements OnModuleInit {
  private readonly logger = new Logger(VipGuestConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly supabaseService: SupabaseService,
    private readonly dataSource: DataSource,
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    @InjectRepository(VipGuest)
    private readonly vipGuestRepository: Repository<VipGuest>,
    @InjectRepository(VipGuestImport)
    private readonly vipGuestImportRepository: Repository<VipGuestImport>,
  ) {}

  async onModuleInit() {
    const role = process.env.INSTANCE_ROLE ?? 'all';
    const isEnabled = ['all', 'worker', 'worker:background'].includes(role);

    if (!isEnabled) {
      this.logger.log(
        `Skipped starting VIP Guest import consumer due to INSTANCE_ROLE: ${role}`,
      );
      return;
    }

    this.startConsuming().catch((err) => {
      this.logger.error('Failed to start VIP Guest import consumer:', err);
    });
  }

  private async startConsuming() {
    this.logger.log(`Starting to consume queue "${VIP_GUEST_IMPORT_QUEUE}"...`);

    await this.rabbitMQService.consume(
      VIP_GUEST_IMPORT_QUEUE,
      async (msg) => {
        if (!msg) return;

        const channel = this.rabbitMQService.getChannel();
        let payload: ImportTaskPayload;

        try {
          payload = JSON.parse(msg.content.toString()) as ImportTaskPayload;
        } catch (err) {
          this.logger.error('Failed to parse VIP Guest import message:', err);
          channel.ack(msg);
          return;
        }

        const { jobId, concertId, fileUrl } = payload;
        this.logger.log(`Processing VIP Guest import job ${jobId} for concert ${concertId}`);

        const errorLogs: Array<{ row: number; email?: string; error: string }> = [];
        let totalRows = 0;
        let importedCount = 0;

        try {
          // 1. Update job status to processing
          await this.vipGuestImportRepository.update(jobId, {
            status: VipGuestImportStatus.PROCESSING,
          });

          // 2. Fetch concert details
          const concert = await this.concertRepository.findOne({
            where: { id: concertId },
          });
          if (!concert) {
            throw new Error(`Concert with ID ${concertId} not found`);
          }

          // 3. Download CSV text from Supabase
          const csvText = await this.supabaseService.downloadFile(fileUrl);

          // 4. Parse CSV text
          const rawRows: any[] = [];
          await new Promise<void>((resolve, reject) => {
            Readable.from(csvText)
              .pipe(csv())
              .on('data', (row) => rawRows.push(row))
              .on('end', () => resolve())
              .on('error', (err) => reject(err));
          });

          totalRows = rawRows.length;
          this.logger.log(`Parsed ${totalRows} rows from CSV file for job ${jobId}`);

          // 5. Get existing guest emails for this concert (case-insensitive checks)
          const existingGuests = await this.vipGuestRepository.find({
            where: { concertId },
            select: ['email'],
          });
          const existingEmails = new Set(
            existingGuests.map((g) => g.email.toLowerCase().trim()),
          );

          const csvEmails = new Set<string>();
          const validGuestsToInsert: any[] = [];

          // 6. Process and validate each row
          let rowIndex = 1; // row 1 is header, data starts at row 2
          for (const rawRow of rawRows) {
            rowIndex++;
            const mappedRow = this.mapRowKeys(rawRow);

            if (!mappedRow.email || !mappedRow.fullName) {
              errorLogs.push({
                row: rowIndex,
                email: mappedRow.email,
                error: 'Missing required fields (fullName, email)',
              });
              continue;
            }

            const emailLower = mappedRow.email.toLowerCase().trim();

            // Validate row data using DTO
            const rowDto = plainToInstance(VipGuestRowDto, mappedRow);
            const errors = await validate(rowDto);

            if (errors.length > 0) {
              const errorMsgs = errors
                .map((e) => Object.values(e.constraints || {}))
                .flat()
                .join(', ');
              errorLogs.push({
                row: rowIndex,
                email: mappedRow.email,
                error: errorMsgs,
              });
              continue;
            }

            // Check for duplicates inside the CSV file itself
            if (csvEmails.has(emailLower)) {
              errorLogs.push({
                row: rowIndex,
                email: mappedRow.email,
                error: 'Duplicate guest email in CSV file',
              });
              continue;
            }

            // Check for duplicates in DB
            if (existingEmails.has(emailLower)) {
              errorLogs.push({
                row: rowIndex,
                email: mappedRow.email,
                error: 'Duplicate guest email for this concert in database',
              });
              continue;
            }

            csvEmails.add(emailLower);

            // Generate signature HMAC-SHA256
            const secret = process.env.JWT_SECRET || 'fallback_secret';
            const hmac = crypto.createHmac('sha256', secret);
            hmac.update(`${concertId}:${emailLower}`);
            const qrCodeHash = hmac.digest('hex');

            // Generate a clean uuid placeholder or wait for typeorm BeforeInsert
            validGuestsToInsert.push({
              id: generateUuidV7(),
              concertId,
              fullName: mappedRow.fullName,
              email: emailLower,
              phone: mappedRow.phone || null,
              affiliateCompany: mappedRow.affiliateCompany || null,
              qrCodeHash,
              status: VipGuestStatus.ACTIVE,
            });
          }

          // 7. Bulk Insert using Transactions
          importedCount = validGuestsToInsert.length;
          if (importedCount > 0) {
            const chunkSize = 500;
            await this.dataSource.transaction(async (manager) => {
              for (let i = 0; i < validGuestsToInsert.length; i += chunkSize) {
                const chunk = validGuestsToInsert.slice(i, i + chunkSize);
                await manager
                  .createQueryBuilder()
                  .insert()
                  .into(VipGuest)
                  .values(chunk)
                  .execute();
              }
            });
            this.logger.log(`Successfully bulk inserted ${importedCount} guests for job ${jobId}`);
          }

          // 8. Update import job status to completed
          await this.vipGuestImportRepository.save({
            id: jobId,
            status: VipGuestImportStatus.COMPLETED,
            totalRows,
            importedRows: importedCount,
            errorLogs: errorLogs.length > 0 ? errorLogs : null,
          });

          // 9. Dispatch notification tasks to RabbitMQ
          for (const guest of validGuestsToInsert) {
            await this.rabbitMQService.sendToQueue('notification.email.vip', {
              email: guest.email,
              fullName: guest.fullName,
              concertTitle: concert.title,
              qrCodeHash: guest.qrCodeHash,
            });
          }

          this.logger.log(`Dispatched ${validGuestsToInsert.length} VIP email notification tasks for job ${jobId}`);
        } catch (err: any) {
          this.logger.error(`Error processing VIP Guest import job ${jobId}: ${err.message}`, err.stack);

          errorLogs.push({
            row: 0,
            error: err.message || err.toString(),
          });

          await this.vipGuestImportRepository.save({
            id: jobId,
            status: VipGuestImportStatus.FAILED,
            totalRows,
            importedRows: importedCount,
            errorLogs,
          });
        } finally {
          // 10. Always clean up the file from Supabase Storage
          await this.supabaseService.deleteFile(fileUrl);
          channel.ack(msg);
        }
      },
      { noAck: false },
      {
        arguments: {
          'x-dead-letter-exchange': 'vip_guest.import.dlx',
          'x-dead-letter-routing-key': 'vip_guest.import.failed',
        },
      },
    );
  }

  /**
   * Maps CSV header variations to expected DTO keys
   */
  private mapRowKeys(row: any) {
    const keys = Object.keys(row);
    const findVal = (possibleKeys: string[]) => {
      const foundKey = keys.find(
        (k) => possibleKeys.includes(k.toLowerCase().trim()),
      );
      return foundKey ? row[foundKey]?.trim() : undefined;
    };

    return {
      fullName: findVal(['fullname', 'full name', 'name', 'ho ten', 'họ tên']),
      email: findVal(['email', 'mail', 'dia chi email', 'địa chỉ email']),
      phone: findVal(['phone', 'phone number', 'sdt', 'số điện thoại', 'telephone']),
      affiliateCompany: findVal([
        'affiliatecompany',
        'affiliate company',
        'company',
        'cong ty',
        'công ty',
        'affiliate_company',
      ]),
    };
  }
}
