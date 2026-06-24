import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { VipGuestConsumer } from './vip-guest.consumer';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { SupabaseService } from '../common/supabase/supabase.service';
import { Concert } from './entities/concert.entity';
import { VipGuest } from './entities/vip-guest.entity';
import { VipGuestImport, VipGuestImportStatus } from './entities/vip-guest-import.entity';

describe('VipGuestConsumer', () => {
  let consumer: VipGuestConsumer;
  let rabbitMQService: RabbitMQService;
  let supabaseService: SupabaseService;

  const mockRabbitMQService = {
    consume: jest.fn(),
    getChannel: jest.fn(),
    sendToQueue: jest.fn(),
  };

  const mockSupabaseService = {
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockConcertRepo = {
    findOne: jest.fn(),
  };

  const mockVipGuestRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockVipGuestImportRepo = {
    update: jest.fn(),
    save: jest.fn(),
  };

  const mockQueryBuilder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation(async (cb) => {
      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };
      return cb(mockManager);
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VipGuestConsumer,
        { provide: RabbitMQService, useValue: mockRabbitMQService },
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: DataSource, useValue: mockDataSource },
        { provide: getRepositoryToken(Concert), useValue: mockConcertRepo },
        { provide: getRepositoryToken(VipGuest), useValue: mockVipGuestRepo },
        { provide: getRepositoryToken(VipGuestImport), useValue: mockVipGuestImportRepo },
      ],
    }).compile();

    consumer = module.get<VipGuestConsumer>(VipGuestConsumer);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should skip starting consumer if role is not enabled', async () => {
      process.env.INSTANCE_ROLE = 'api';
      await consumer.onModuleInit();
      expect(mockRabbitMQService.consume).not.toHaveBeenCalled();
    });

    it('should start consumer if role is enabled', async () => {
      process.env.INSTANCE_ROLE = 'worker';
      mockRabbitMQService.consume.mockResolvedValue({});
      await consumer.onModuleInit();
      expect(mockRabbitMQService.consume).toHaveBeenCalled();
    });
  });

  describe('CSV processing', () => {
    let messageHandler: any;

    beforeEach(async () => {
      process.env.INSTANCE_ROLE = 'all';
      mockRabbitMQService.consume.mockImplementation((queue, cb) => {
        messageHandler = cb;
        return Promise.resolve({});
      });
      await consumer.onModuleInit();
    });

    it('should process valid CSV file and upload guests', async () => {
      const mockChannel = {
        ack: jest.fn(),
      };
      mockRabbitMQService.getChannel.mockReturnValue(mockChannel);

      const msg = {
        content: Buffer.from(
          JSON.stringify({
            jobId: 'job-id',
            concertId: 'concert-id',
            fileUrl: 'path/to/file.csv',
          }),
        ),
      };

      const csvContent = `Full Name,Email,Phone,Company\nJohn Doe,john@example.com,0912345678,Google\nJane Doe,jane@example.com,0987654321,Meta`;
      mockSupabaseService.downloadFile.mockResolvedValue(csvContent);
      mockConcertRepo.findOne.mockResolvedValue({ id: 'concert-id', title: 'Concert Title' });
      mockVipGuestRepo.find.mockResolvedValue([]); // No existing duplicates

      mockVipGuestRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Invoke the consumer message handler
      await messageHandler(msg);

      expect(mockSupabaseService.downloadFile).toHaveBeenCalledWith('path/to/file.csv');
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockVipGuestImportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-id',
          status: VipGuestImportStatus.COMPLETED,
          totalRows: 2,
          importedRows: 2,
        }),
      );
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalledTimes(2);
      expect(mockSupabaseService.deleteFile).toHaveBeenCalledWith('path/to/file.csv');
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it('should handle duplicate emails and log them as errors', async () => {
      const mockChannel = {
        ack: jest.fn(),
      };
      mockRabbitMQService.getChannel.mockReturnValue(mockChannel);

      const msg = {
        content: Buffer.from(
          JSON.stringify({
            jobId: 'job-id',
            concertId: 'concert-id',
            fileUrl: 'path/to/file.csv',
          }),
        ),
      };

      // Duplicate email in CSV, and also duplicate of existing guest
      const csvContent = `Full Name,Email,Phone,Company\nJohn Doe,john@example.com,0912345678,Google\nJohn Dup,john@example.com,0987654321,Google\nJane Doe,jane@example.com,0901234567,Meta`;
      mockSupabaseService.downloadFile.mockResolvedValue(csvContent);
      mockConcertRepo.findOne.mockResolvedValue({ id: 'concert-id', title: 'Concert Title' });
      // jane@example.com already exists in the database
      mockVipGuestRepo.find.mockResolvedValue([{ email: 'jane@example.com' }]);

      await messageHandler(msg);

      expect(mockVipGuestImportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'job-id',
          status: VipGuestImportStatus.COMPLETED,
          totalRows: 3,
          importedRows: 1, // Only John Doe is inserted
          errorLogs: [
            {
              row: 3,
              email: 'john@example.com',
              reason: 'Duplicate guest email in CSV file',
            },
          ],
        }),
      );
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalledTimes(1);
      expect(mockSupabaseService.deleteFile).toHaveBeenCalledWith('path/to/file.csv');
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });
  });
});
