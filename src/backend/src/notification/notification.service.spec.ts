import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from './notification.service';
import { NotificationLog, NotificationType, NotificationChannel, NotificationStatus } from './entities/notification-log.entity';
import { NotificationGateway } from './notification.gateway';
import { NotFoundException } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: Repository<NotificationLog>;
  let gateway: NotificationGateway;

  const mockRepository = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 1, ...entity, createdAt: new Date() })),
    findAndCount: jest.fn(() => Promise.resolve([[] as any[], 0])),
    findOne: jest.fn(),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
  };

  const mockGateway = {
    sendNotificationToUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: mockRepository,
        },
        {
          provide: NotificationGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repository = module.get<Repository<NotificationLog>>(getRepositoryToken(NotificationLog));
    gateway = module.get<NotificationGateway>(NotificationGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createNotification', () => {
    it('should create and save in_app notification and push to gateway', async () => {
      const data = {
        type: NotificationType.AI_BIO_COMPLETED,
        title: 'Success',
        body: 'Details',
        channel: NotificationChannel.IN_APP,
      };
      const userId = 'user-uuid';

      mockRepository.save.mockResolvedValueOnce({
        id: 1,
        userId,
        ...data,
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      });

      const result = await service.createNotification(userId, data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          channel: NotificationChannel.IN_APP,
          status: NotificationStatus.UNREAD,
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(gateway.sendNotificationToUser).toHaveBeenCalledWith(
        userId,
        'notification_received',
        expect.objectContaining({ userId, title: 'Success' }),
      );
      expect(result.id).toBe(1);
    });

    it('should create and save email notification but not push to gateway', async () => {
      const data = {
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Confirmed',
        body: 'Details',
        channel: NotificationChannel.EMAIL,
      };
      const userId = 'user-uuid';

      mockRepository.save.mockResolvedValueOnce({
        id: 2,
        userId,
        ...data,
        status: NotificationStatus.UNREAD,
        createdAt: new Date(),
      });

      const result = await service.createNotification(userId, data);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          channel: NotificationChannel.EMAIL,
        }),
      );
      expect(gateway.sendNotificationToUser).not.toHaveBeenCalled();
      expect(result.id).toBe(2);
    });
  });

  describe('getUserNotifications', () => {
    it('should call findAndCount with pagination', async () => {
      const userId = 'user-uuid';
      const mockLogs = [
        { id: 1, userId, channel: NotificationChannel.IN_APP, title: 'N1' },
        { id: 2, userId, channel: NotificationChannel.IN_APP, title: 'N2' },
      ];
      mockRepository.findAndCount.mockResolvedValueOnce([mockLogs, 2]);

      const result = await service.getUserNotifications(userId, 1, 10);

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, channel: NotificationChannel.IN_APP },
          order: { createdAt: 'DESC' },
          skip: 0,
          take: 10,
        }),
      );
      expect(result.data).toEqual(mockLogs);
      expect(result.meta).toEqual({
        totalItems: 2,
        itemCount: 2,
        itemsPerPage: 10,
        totalPages: 1,
        currentPage: 1,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark an unread notification as read', async () => {
      const userId = 'user-uuid';
      const mockLog = { id: 5, userId, channel: NotificationChannel.IN_APP, status: NotificationStatus.UNREAD, readAt: null };
      mockRepository.findOne.mockResolvedValueOnce(mockLog);
      mockRepository.save.mockResolvedValueOnce({
        ...mockLog,
        status: NotificationStatus.READ,
        readAt: new Date(),
      });

      const result = await service.markAsRead(userId, 5);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 5, userId, channel: NotificationChannel.IN_APP },
      });
      expect(result.status).toBe('read');
      expect(result.readAt).toBeDefined();
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.markAsRead('user-uuid', 99)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should call update on repository', async () => {
      const userId = 'user-uuid';
      await service.markAllAsRead(userId);

      expect(repository.update).toHaveBeenCalledWith(
        { userId, channel: NotificationChannel.IN_APP, status: NotificationStatus.UNREAD },
        expect.objectContaining({ status: NotificationStatus.READ, readAt: expect.any(Date) }),
      );
    });
  });
});
