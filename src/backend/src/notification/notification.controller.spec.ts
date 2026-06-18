import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecutionContext, NotFoundException } from '@nestjs/common';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockNotificationService = {
    getUserNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should call service getUserNotifications with correct params', async () => {
      const req = { user: { userId: 'user-uuid' } };
      const mockResult = {
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      };
      mockNotificationService.getUserNotifications.mockResolvedValueOnce(mockResult);

      const result = await controller.getNotifications(req, '1', '10');

      expect(service.getUserNotifications).toHaveBeenCalledWith('user-uuid', 1, 10);
      expect(result).toEqual(mockResult);
    });

    it('should fall back to default page/limit if values are invalid strings', async () => {
      const req = { user: { userId: 'user-uuid' } };
      mockNotificationService.getUserNotifications.mockResolvedValueOnce({
        data: [],
        meta: {
          totalItems: 0,
          itemCount: 0,
          itemsPerPage: 10,
          totalPages: 0,
          currentPage: 1,
        },
      });

      await controller.getNotifications(req, 'invalid', 'invalid');

      expect(service.getUserNotifications).toHaveBeenCalledWith('user-uuid', 1, 10);
    });
  });

  describe('markAllAsRead', () => {
    it('should call service markAllAsRead', async () => {
      const req = { user: { userId: 'user-uuid' } };
      mockNotificationService.markAllAsRead.mockResolvedValueOnce(undefined);

      const result = await controller.markAllAsRead(req);

      expect(service.markAllAsRead).toHaveBeenCalledWith('user-uuid');
      expect(result).toEqual({ success: true });
    });
  });

  describe('markAsRead', () => {
    it('should call service markAsRead', async () => {
      const req = { user: { userId: 'user-uuid' } };
      const mockResult = { id: 123, status: 'read' };
      mockNotificationService.markAsRead.mockResolvedValueOnce(mockResult);

      const result = await controller.markAsRead(req, 123);

      expect(service.markAsRead).toHaveBeenCalledWith('user-uuid', 123);
      expect(result).toEqual(mockResult);
    });

    it('should throw exception if service throws', async () => {
      const req = { user: { userId: 'user-uuid' } };
      mockNotificationService.markAsRead.mockRejectedValueOnce(new NotFoundException());

      await expect(controller.markAsRead(req, 123)).rejects.toThrow(NotFoundException);
    });
  });
});
