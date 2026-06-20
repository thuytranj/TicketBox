import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationCleanupService } from './notification-cleanup.service';
import { NotificationLog } from './entities/notification-log.entity';
import { RedisService } from '../common/redis/redis.service';

describe('NotificationCleanupService', () => {
  let service: NotificationCleanupService;
  let repository: Repository<NotificationLog>;
  let redisService: RedisService;

  const mockQueryBuilder = {
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockRedisService = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCleanupService,
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<NotificationCleanupService>(
      NotificationCleanupService,
    );
    repository = module.get<Repository<NotificationLog>>(
      getRepositoryToken(NotificationLog),
    );
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip cleanup if lock cannot be acquired', async () => {
    mockRedisService.acquireLock.mockResolvedValue(false);

    await service.cleanupOldNotifications();

    expect(mockRedisService.acquireLock).toHaveBeenCalledWith(
      '{notification-cleanup}:lock',
      60000,
    );
    expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    expect(mockRedisService.releaseLock).not.toHaveBeenCalled();
  });

  it('should perform cleanup in batches when lock is acquired', async () => {
    mockRedisService.acquireLock.mockResolvedValue(true);
    mockQueryBuilder.execute
      .mockResolvedValueOnce({ affected: 5000 })
      .mockResolvedValueOnce({ affected: 2000 });

    await service.cleanupOldNotifications();

    expect(mockRedisService.acquireLock).toHaveBeenCalledWith(
      '{notification-cleanup}:lock',
      60000,
    );
    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(2);
    expect(mockQueryBuilder.execute).toHaveBeenCalledTimes(2);
    expect(mockRedisService.releaseLock).toHaveBeenCalledWith(
      '{notification-cleanup}:lock',
    );
  });

  it('should release lock even if an error is thrown during cleanup', async () => {
    mockRedisService.acquireLock.mockResolvedValue(true);
    mockQueryBuilder.execute.mockRejectedValue(new Error('DB connection lost'));

    await service.cleanupOldNotifications();

    expect(repository.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(mockRedisService.releaseLock).toHaveBeenCalledWith(
      '{notification-cleanup}:lock',
    );
  });
});
