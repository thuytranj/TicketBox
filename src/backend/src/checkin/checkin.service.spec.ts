import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CheckinService, CHECKIN_SYNC_QUEUE } from './checkin.service';
import { Ticket, TicketStatus } from '../booking/entities/ticket.entity';
import { CheckinStatus } from '../common/enums/checkin-status.enum';
import { VipGuest, VipGuestStatus } from '../concert/entities/vip-guest.entity';
import { Concert } from '../concert/entities/concert.entity';
import { CheckinLog } from './entities/checkin-log.entity';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';

describe('CheckinService', () => {
  let service: CheckinService;
  let ticketRepo: jest.Mocked<Repository<Ticket>>;
  let vipGuestRepo: jest.Mocked<Repository<VipGuest>>;
  let concertRepo: jest.Mocked<Repository<Concert>>;
  let checkinLogRepo: jest.Mocked<Repository<CheckinLog>>;
  let rabbitMQService: jest.Mocked<RabbitMQService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockConcert = { id: 'concert-1', title: 'Test Concert' } as Concert;
  const mockTicket = {
    id: 'ticket-1',
    qrCodeHash: 'hash_abc_123',
    checkinStatus: CheckinStatus.NOT_CHECKED_IN,
    checkedInAt: null,
    orderId: 'order-1',
    ticketTypeId: 'type-1',
    status: TicketStatus.ACTIVE,
    ticketType: { name: 'GA' },
  } as any;

  const mockVipGuest = {
    id: 'vip-1',
    qrCodeHash: 'hash_vip_789',
    checkinStatus: CheckinStatus.NOT_CHECKED_IN,
    checkedInAt: null,
    concertId: 'concert-1',
    status: VipGuestStatus.ACTIVE,
  } as any;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };

  const mockTransactionManager = {
    update: jest.fn(),
    create: jest.fn().mockReturnValue({}),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        {
          provide: getRepositoryToken(Ticket),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(VipGuest),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Concert),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CheckinLog),
          useValue: {},
        },
        {
          provide: RabbitMQService,
          useValue: {
            sendToQueue: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn().mockImplementation(async (cb) => {
              return cb(mockTransactionManager);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    ticketRepo = module.get(getRepositoryToken(Ticket));
    vipGuestRepo = module.get(getRepositoryToken(VipGuest));
    concertRepo = module.get(getRepositoryToken(Concert));
    checkinLogRepo = module.get(getRepositoryToken(CheckinLog));
    rabbitMQService = module.get(RabbitMQService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCheckinData', () => {
    it('should throw NotFoundException when concert does not exist', async () => {
      (concertRepo.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getCheckinData('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return tickets and vipGuests for a valid concert', async () => {
      (concertRepo.findOne as jest.Mock).mockResolvedValue(mockConcert);
      mockQueryBuilder.getMany.mockResolvedValue([mockTicket]);
      (vipGuestRepo.find as jest.Mock).mockResolvedValue([mockVipGuest]);

      const result = await service.getCheckinData('concert-1');

      expect(result.concertId).toBe('concert-1');
      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].id).toBe('ticket-1');
      expect(result.tickets[0].qrCodeHash).toBe('hash_abc_123');
      expect(result.tickets[0].zoneId).toBe('GA');
      expect(result.vipGuests).toHaveLength(1);
      expect(result.vipGuests[0].id).toBe('vip-1');
    });
  });

  describe('scanQrCode', () => {
    const scanDto = {
      concertId: 'concert-1',
      qrCodeHash: 'hash_abc_123',
      deviceId: 'scanner_01',
      scanTime: '2026-07-20T18:30:15.000Z',
    };

    it('should check-in a regular ticket successfully', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(mockTicket);

      const result = await service.scanQrCode(scanDto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('regular_ticket');
      expect(result.data.ticketId).toBe('ticket-1');
      expect(result.data.checkinStatus).toBe('checked_in');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'ticket.status = :ticketStatus',
        { ticketStatus: TicketStatus.ACTIVE },
      );
      expect(mockTransactionManager.update).toHaveBeenCalled();
      expect(mockTransactionManager.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for duplicate check-in', async () => {
      const checkedInTicket = {
        ...mockTicket,
        checkinStatus: CheckinStatus.CHECKED_IN,
      };
      mockQueryBuilder.getOne.mockResolvedValue(checkedInTicket);

      await expect(
        service.scanQrCode(scanDto, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should check-in a VIP guest when ticket not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null); // No ticket found
      (vipGuestRepo.findOne as jest.Mock).mockResolvedValue(mockVipGuest);

      const vipScanDto = {
        ...scanDto,
        qrCodeHash: 'hash_vip_789',
      };

      const result = await service.scanQrCode(vipScanDto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.data.type).toBe('vip_guest');
      expect(vipGuestRepo.findOne).toHaveBeenCalledWith({
        where: {
          qrCodeHash: 'hash_vip_789',
          concertId: 'concert-1',
          status: VipGuestStatus.ACTIVE,
        },
      });
    });

    it('should throw NotFoundException when QR code not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);
      (vipGuestRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.scanQrCode(scanDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncOfflineCheckins', () => {
    const syncDto = {
      concertId: 'concert-1',
      offlineLogs: [
        {
          qrCodeHash: 'hash_abc_123',
          deviceId: 'scanner_02',
          scanTime: '2026-07-20T18:35:10.000Z',
        },
        {
          qrCodeHash: 'hash_def_456',
          deviceId: 'scanner_02',
          scanTime: '2026-07-20T18:36:20.000Z',
        },
      ],
    };

    it('should throw NotFoundException when concert does not exist', async () => {
      (concertRepo.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.syncOfflineCheckins(syncDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should publish offline logs to RabbitMQ and return 202 response', async () => {
      (concertRepo.findOne as jest.Mock).mockResolvedValue(mockConcert);
      (rabbitMQService.sendToQueue as jest.Mock).mockResolvedValue(true);

      const result = await service.syncOfflineCheckins(syncDto, 'user-1');

      expect(result.success).toBe(true);
      expect(result.total).toBe(2);
      expect(result.message).toContain('accepted');
      expect(rabbitMQService.sendToQueue).toHaveBeenCalledWith(
        CHECKIN_SYNC_QUEUE,
        expect.objectContaining({
          concertId: 'concert-1',
          userId: 'user-1',
          offlineLogs: syncDto.offlineLogs,
        }),
      );
    });
  });
});
