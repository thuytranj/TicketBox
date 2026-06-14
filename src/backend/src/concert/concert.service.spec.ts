import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConcertService } from './concert.service';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { TicketType, TicketTypeName } from './entities/ticket-type.entity';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { ConcertQueryDto } from './dto/concert-query.dto';
import { RedisService } from '../common/redis/redis.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ConcertService', () => {
  let service: ConcertService;
  let concertRepository: Repository<Concert>;
  let ticketTypeRepository: Repository<TicketType>;
  let entityManager: EntityManager;
  let redisService: RedisService;

  const mockConcertRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
    merge: jest.fn(),
  };

  const mockTicketTypeRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    merge: jest.fn(),
  };

  const mockEntityManager = {
    query: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    mget: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcertService,
        {
          provide: getRepositoryToken(Concert),
          useValue: mockConcertRepository,
        },
        {
          provide: getRepositoryToken(TicketType),
          useValue: mockTicketTypeRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<ConcertService>(ConcertService);
    concertRepository = module.get<Repository<Concert>>(getRepositoryToken(Concert));
    ticketTypeRepository = module.get<Repository<TicketType>>(getRepositoryToken(TicketType));
    entityManager = module.get<EntityManager>(EntityManager);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a concert successfully with valid fields', async () => {
      const dto = {
        title: 'Rock Concert 2026',
        description: 'Rock Night',
        location: 'Hanoi',
        startTime: '2026-07-01T19:00:00Z',
        endTime: '2026-07-01T22:00:00Z',
        ticketTypes: [
          { name: 'VIP', price: 500000, totalQuantity: 100 },
        ],
      };

      mockConcertRepository.create.mockReturnValue(dto);
      mockConcertRepository.save.mockResolvedValue({ id: 'concert-id', ...dto });

      mockRedisService.keys.mockResolvedValue(['cache:concerts:list:default:page:1:limit:10']);

      const result = await service.create(dto as any);
      expect(result).toBeDefined();
      expect(result.id).toBe('concert-id');
      expect(concertRepository.save).toHaveBeenCalled();
      expect(redisService.keys).toHaveBeenCalledWith('cache:concerts:list:default:*');
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:list:default:page:1:limit:10');
    });

    it('should throw BadRequestException if endTime <= startTime', async () => {
      const dto = {
        title: 'Rock Concert 2026',
        startTime: '2026-07-01T22:00:00Z',
        endTime: '2026-07-01T19:00:00Z',
      };

      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if duplicate ticket type names provided', async () => {
      const dto = {
        title: 'Rock Concert 2026',
        startTime: '2026-07-01T19:00:00Z',
        endTime: '2026-07-01T22:00:00Z',
        ticketTypes: [
          { name: 'VIP', price: 500000, totalQuantity: 100 },
          { name: 'vip', price: 400000, totalQuantity: 50 },
        ],
      };

      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if saleEndTime <= saleStartTime', async () => {
      const dto = {
        title: 'Rock Concert 2026',
        startTime: '2026-07-01T19:00:00Z',
        endTime: '2026-07-01T22:00:00Z',
        ticketTypes: [
          {
            name: 'VIP',
            price: 500000,
            totalQuantity: 100,
            saleStartTime: '2026-07-01T20:00:00Z',
            saleEndTime: '2026-07-01T19:00:00Z',
          },
        ],
      };

      await expect(service.create(dto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne (Cache-aside)', () => {
    it('should return cached concert details on Cache Hit', async () => {
      const cached = JSON.stringify({ id: 'c-1', title: 'Cached Concert' });
      mockRedisService.get.mockResolvedValue(cached);

      const result = await service.findOne('c-1');
      expect(result).toEqual({ id: 'c-1', title: 'Cached Concert' });
      expect(concertRepository.findOne).not.toHaveBeenCalled();
    });

    it('should query DB and save to Redis on Cache Miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const dbVal = { id: 'c-1', title: 'DB Concert' };
      mockConcertRepository.findOne.mockResolvedValue(dbVal);

      const result = await service.findOne('c-1');
      expect(result).toEqual(dbVal);
      expect(concertRepository.findOne).toHaveBeenCalled();
      expect(redisService.setex).toHaveBeenCalledWith('cache:concerts:c-1', 600, expect.any(String));
    });

    it('should throw NotFoundException if not in DB', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockConcertRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findStageMap (Cache-aside)', () => {
    it('should return cached stage map on Cache Hit', async () => {
      mockRedisService.get.mockResolvedValue('<svg>Stage</svg>');

      const result = await service.findStageMap('c-1');
      expect(result).toBe('<svg>Stage</svg>');
      expect(concertRepository.findOne).not.toHaveBeenCalled();
    });

    it('should query DB and save to Redis on Cache Miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockConcertRepository.findOne.mockResolvedValue({ id: 'c-1', svgStageMap: '<svg>Stage</svg>' });

      const result = await service.findStageMap('c-1');
      expect(result).toBe('<svg>Stage</svg>');
      expect(concertRepository.findOne).toHaveBeenCalled();
      expect(redisService.setex).toHaveBeenCalledWith('cache:concerts:c-1:stagemap', 1800, '<svg>Stage</svg>');
    });
  });

  describe('findTicketTypes (Hybrid Caching)', () => {
    it('should return cached ticket types on Cache Hit and fetch quantities from Redis', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);

      const cachedTicketTypes = [{ id: 'tt-1', name: 'VIP', price: 100, availableQuantity: 50 }];
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedTicketTypes));
      mockRedisService.mget.mockResolvedValue(['42']);

      const result = await service.findTicketTypes('c-1');
      expect(result).toBeDefined();
      expect(result[0].availableQuantity).toBe(42);
      expect(redisService.get).toHaveBeenCalledWith('cache:concerts:c-1:ticket-types');
      expect(redisService.mget).toHaveBeenCalledWith('inventory:c-1:tt-1');
    });

    it('should query DB, save to cache and fetch quantities from Redis on Cache Miss', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);

      mockRedisService.get.mockResolvedValue(null);
      const dbTicketTypes = [{ id: 'tt-1', name: 'VIP', price: 100, availableQuantity: 50 }];
      mockTicketTypeRepository.find.mockResolvedValue(dbTicketTypes);
      mockRedisService.mget.mockResolvedValue(['10']);

      const result = await service.findTicketTypes('c-1');
      expect(result).toBeDefined();
      expect(result[0].availableQuantity).toBe(10);
      expect(redisService.setex).toHaveBeenCalledWith('cache:concerts:c-1:ticket-types', 600, expect.any(String));
      expect(redisService.mget).toHaveBeenCalledWith('inventory:c-1:tt-1');
    });

    it('should throw NotFoundException if concert does not exist', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);

      await expect(service.findTicketTypes('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update concert details and invalidate cache', async () => {
      const concert = { id: 'c-1', title: 'Old Title', startTime: new Date('2026-07-01T19:00:00Z'), endTime: new Date('2026-07-01T22:00:00Z') };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockConcertRepository.save.mockResolvedValue({ ...concert, title: 'New Title' });

      mockRedisService.keys.mockResolvedValue(['cache:concerts:list:default:page:1:limit:10']);

      const result = await service.update('c-1', { title: 'New Title' });
      expect(result.title).toBe('New Title');
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1:stagemap');
      expect(redisService.keys).toHaveBeenCalledWith('cache:concerts:list:default:*');
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:list:default:page:1:limit:10');
    });
  });

  describe('remove', () => {
    it('should hard delete concert and invalidate cache if no bookings exist', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockEntityManager.query.mockResolvedValue([]); // No bookings

      await service.remove('c-1');
      expect(concertRepository.remove).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
    });

    it('should throw BadRequestException if bookings exist', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockEntityManager.query.mockResolvedValue([{ 1: 1 }]); // Bookings exist

      await expect(service.remove('c-1')).rejects.toThrow(BadRequestException);
      expect(concertRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('TicketType management', () => {
    describe('createTicketType', () => {
      it('should create ticket type successfully', async () => {
        const concert = { id: 'c-1', endTime: new Date('2026-07-01T22:00:00Z') };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);
        mockTicketTypeRepository.create.mockReturnValue({ name: TicketTypeName.VIP, price: 100 });
        mockTicketTypeRepository.save.mockResolvedValue({ id: 'tt-1', name: TicketTypeName.VIP, price: 100 });

        const result = await service.createTicketType('c-1', { name: TicketTypeName.VIP, price: 100, totalQuantity: 50 });
        expect(result).toBeDefined();
        expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      });

      it('should throw BadRequestException if saleStartTime >= saleEndTime', async () => {
        const concert = { id: 'c-1', endTime: new Date('2026-07-01T22:00:00Z') };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);

        const dto: CreateTicketTypeDto = {
          name: TicketTypeName.VIP,
          price: 100,
          totalQuantity: 50,
          saleStartTime: '2026-07-01T20:00:00Z',
          saleEndTime: '2026-07-01T19:00:00Z',
        };

        await expect(service.createTicketType('c-1', dto)).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException if saleStartTime >= concert.endTime', async () => {
        const concert = { id: 'c-1', endTime: new Date('2026-07-01T22:00:00Z') };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);

        const dto: CreateTicketTypeDto = {
          name: TicketTypeName.VIP,
          price: 100,
          totalQuantity: 50,
          saleStartTime: '2026-07-01T23:00:00Z', // After concert end
        };

        await expect(service.createTicketType('c-1', dto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateTicketType', () => {
      it('should update ticket type and invalidate cache', async () => {
        const concert = { id: 'c-1', endTime: new Date('2026-07-01T22:00:00Z') };
        const ticketType = { id: 'tt-1', concertId: 'c-1', name: TicketTypeName.VIP, totalQuantity: 50, availableQuantity: 50 };
        mockTicketTypeRepository.findOne.mockResolvedValue(ticketType);
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.save.mockResolvedValue({ ...ticketType, price: 150 });

        const result = await service.updateTicketType('tt-1', { price: 150 });
        expect(result).toBeDefined();
        expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      });
    });
  });

  describe('findAll', () => {
    it('should return cached concerts and metadata on default request Cache Hit', async () => {
      mockRedisService.get.mockResolvedValue(JSON.stringify({
        concerts: [{ id: 'c-1', title: 'Cached Concert' }],
        meta: { totalItems: 1, currentPage: 1 },
      }));

      const result = await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        concerts: [{ id: 'c-1', title: 'Cached Concert' }],
        meta: { totalItems: 1, currentPage: 1 },
      });
      expect(redisService.get).toHaveBeenCalledWith('cache:concerts:list:default:page:1:limit:10');
      expect(concertRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should query DB and save to Redis on default request Cache Miss', async () => {
      mockRedisService.get.mockResolvedValue(null);
      const concerts = [{ id: 'c-1', title: 'DB Concert' }];
      const total = 1;

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([concerts, total]),
      };
      mockConcertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        concerts,
        meta: {
          totalItems: total,
          itemCount: 1,
          itemsPerPage: 10,
          totalPages: 1,
          currentPage: 1,
        },
      });
      expect(redisService.get).toHaveBeenCalledWith('cache:concerts:list:default:page:1:limit:10');
      expect(redisService.setex).toHaveBeenCalledWith(
        'cache:concerts:list:default:page:1:limit:10',
        600,
        expect.any(String),
      );
    });

    it('should bypass cache on non-default request', async () => {
      const concerts = [{ id: 'c-1', title: 'Filtered Concert' }];
      const total = 1;

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([concerts, total]),
      };
      mockConcertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        search: 'Rock',
        location: 'Hanoi',
        tag: 'music',
        status: 'active',
      });

      expect(result).toEqual({
        concerts,
        meta: {
          totalItems: total,
          itemCount: concerts.length,
          itemsPerPage: 5,
          totalPages: 1,
          currentPage: 2,
        },
      });
      expect(redisService.get).not.toHaveBeenCalled();
      expect(redisService.setex).not.toHaveBeenCalled();
      expect(mockConcertRepository.createQueryBuilder).toHaveBeenCalledWith('concert');
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
    });
  });
});

