import { Test, TestingModule } from '@nestjs/testing';
import { TicketTypeController } from './ticket-type.controller';
import { ConcertService } from './concert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('TicketTypeController', () => {
  let controller: TicketTypeController;
  let service: ConcertService;

  const mockConcertService = {
    updateTicketType: jest.fn(),
    removeTicketType: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketTypeController],
      providers: [
        {
          provide: ConcertService,
          useValue: mockConcertService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TicketTypeController>(TicketTypeController);
    service = module.get<ConcertService>(ConcertService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should call service.updateTicketType with id and DTO', async () => {
      const dto = { price: 150 };
      mockConcertService.updateTicketType.mockResolvedValue({
        id: 'tt-1',
        ...dto,
      });

      const result = await controller.update('tt-1', dto);
      expect(result).toBeDefined();
      expect(service.updateTicketType).toHaveBeenCalledWith('tt-1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.removeTicketType with id', async () => {
      mockConcertService.removeTicketType.mockResolvedValue(undefined);

      await controller.remove('tt-1');
      expect(service.removeTicketType).toHaveBeenCalledWith('tt-1');
    });
  });
});
