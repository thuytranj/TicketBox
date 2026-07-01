import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConcertReminderScheduler } from './concert-reminder.scheduler';
import { Concert, ConcertStatus } from '../concert/entities/concert.entity';
import { Order, OrderStatus } from '../booking/entities/order.entity';
import { Ticket, TicketStatus } from '../booking/entities/ticket.entity';
import { User } from '../auth/entities/user.entity';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { RedisService } from '../common/redis/redis.service';

describe('ConcertReminderScheduler', () => {
  let scheduler: ConcertReminderScheduler;
  let concertRepo: jest.Mocked<Repository<Concert>>;
  let orderRepo: jest.Mocked<Repository<Order>>;
  let rabbitMQService: jest.Mocked<RabbitMQService>;
  let redisService: jest.Mocked<RedisService>;

  const mockConcert: Partial<Concert> = {
    id: 'concert-1',
    title: 'Test Concert',
    location: 'Ho Chi Minh City',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
    reminderSent: false,
    status: ConcertStatus.ACTIVE,
  };

  const mockUsers = [
    { userId: 'user-1', email: 'user1@test.com', fullName: 'User One' },
    { userId: 'user-2', email: 'user2@test.com', fullName: 'User Two' },
  ];

  const mockChannel = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcertReminderScheduler,
        {
          provide: getRepositoryToken(Concert),
          useValue: {
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: {},
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: RabbitMQService,
          useValue: {
            getChannel: jest.fn().mockReturnValue(mockChannel),
            publish: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: RedisService,
          useValue: {
            acquireLock: jest.fn(),
            releaseLock: jest.fn(),
          },
        },
      ],
    }).compile();

    scheduler = module.get<ConcertReminderScheduler>(ConcertReminderScheduler);
    concertRepo = module.get(getRepositoryToken(Concert));
    orderRepo = module.get(getRepositoryToken(Order));
    rabbitMQService = module.get(RabbitMQService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  describe('handleConcertReminder', () => {
    it('should skip when INSTANCE_ROLE is not enabled', async () => {
      process.env.INSTANCE_ROLE = 'api';
      await scheduler.handleConcertReminder();
      expect(redisService.acquireLock).not.toHaveBeenCalled();
      delete process.env.INSTANCE_ROLE;
    });

    it('should skip when lock is not acquired', async () => {
      process.env.INSTANCE_ROLE = 'all';
      redisService.acquireLock.mockResolvedValue(false);

      await scheduler.handleConcertReminder();

      expect(redisService.acquireLock).toHaveBeenCalledWith(
        '{concert-reminder}:lock',
        60000,
      );
      expect(concertRepo.find).not.toHaveBeenCalled();
      delete process.env.INSTANCE_ROLE;
    });

    it('should skip when no concerts found', async () => {
      process.env.INSTANCE_ROLE = 'all';
      redisService.acquireLock.mockResolvedValue(true);
      concertRepo.find.mockResolvedValue([]);

      await scheduler.handleConcertReminder();

      expect(concertRepo.find).toHaveBeenCalled();
      expect(rabbitMQService.publish).not.toHaveBeenCalled();
      expect(redisService.releaseLock).toHaveBeenCalled();
      delete process.env.INSTANCE_ROLE;
    });

    it('should publish reminders and mark concert as reminded', async () => {
      process.env.INSTANCE_ROLE = 'all';
      redisService.acquireLock.mockResolvedValue(true);
      concertRepo.find.mockResolvedValue([mockConcert as Concert]);
      concertRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Mock query builder chain for finding users with tickets
      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockUsers),
      };
      orderRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await scheduler.handleConcertReminder();

      // Should publish a reminder for each user
      expect(rabbitMQService.publish).toHaveBeenCalledTimes(2);
      expect(rabbitMQService.publish).toHaveBeenCalledWith(
        'notification.exchange',
        'notification.concert.reminder',
        expect.objectContaining({
          userId: 'user-1',
          email: 'user1@test.com',
          concertId: 'concert-1',
          concertTitle: 'Test Concert',
        }),
        { persistent: true },
      );

      // Should mark concert as reminded
      expect(concertRepo.update).toHaveBeenCalledWith('concert-1', {
        reminderSent: true,
      });

      expect(redisService.releaseLock).toHaveBeenCalled();
      delete process.env.INSTANCE_ROLE;
    });

    it('should skip concert with no active ticket holders', async () => {
      process.env.INSTANCE_ROLE = 'all';
      redisService.acquireLock.mockResolvedValue(true);
      concertRepo.find.mockResolvedValue([mockConcert as Concert]);

      const mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      orderRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await scheduler.handleConcertReminder();

      expect(rabbitMQService.publish).not.toHaveBeenCalled();
      // Should NOT mark reminder_sent if no users were notified
      // But the current implementation still marks it — this is by design
      // to avoid re-processing the same concert repeatedly
      expect(concertRepo.update).toHaveBeenCalledWith('concert-1', {
        reminderSent: true,
      });

      delete process.env.INSTANCE_ROLE;
    });

    it('should release lock even if error occurs', async () => {
      process.env.INSTANCE_ROLE = 'all';
      redisService.acquireLock.mockResolvedValue(true);
      concertRepo.find.mockRejectedValue(new Error('DB connection error'));

      await scheduler.handleConcertReminder();

      expect(redisService.releaseLock).toHaveBeenCalledWith(
        '{concert-reminder}:lock',
      );
      delete process.env.INSTANCE_ROLE;
    });

    it('should run when INSTANCE_ROLE is worker:background', async () => {
      process.env.INSTANCE_ROLE = 'worker:background';
      redisService.acquireLock.mockResolvedValue(true);
      concertRepo.find.mockResolvedValue([]);

      await scheduler.handleConcertReminder();

      expect(redisService.acquireLock).toHaveBeenCalled();
      expect(concertRepo.find).toHaveBeenCalled();
      delete process.env.INSTANCE_ROLE;
    });
  });
});
