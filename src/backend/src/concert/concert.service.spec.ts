import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ConcertService } from './concert.service';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { TicketType, TicketTypeName } from './entities/ticket-type.entity';
import {
  ConcertAIBio,
  ConcertAIBioStatus,
} from './entities/concert-ai-bio.entity';
import { VipGuest } from './entities/vip-guest.entity';
import { VipGuestImport } from './entities/vip-guest-import.entity';
import { SupabaseService } from '../common/supabase/supabase.service';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { ConcertQueryDto } from './dto/concert-query.dto';
import { RedisService } from '../common/redis/redis.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { RabbitMQService } from '../common/rabbitmq/rabbitmq.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock('pdf-parse', () => {
  return {
    PDFParse: jest.fn().mockImplementation(() => {
      return {
        getText: mockGetText,
        destroy: mockDestroy,
      };
    }),
  };
});

import { PDFParse } from 'pdf-parse';

describe('ConcertService', () => {
  let service: ConcertService;
  let concertRepository: Repository<Concert>;
  let ticketTypeRepository: Repository<TicketType>;
  let entityManager: EntityManager;
  let redisService: RedisService;
  let concertAIBioRepository: Repository<ConcertAIBio>;
  let rabbitMQService: RabbitMQService;

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

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const mockConcertAIBioRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRabbitMQService = {
    sendToQueue: jest.fn(),
  };

  const mockVipGuestRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockVipGuestImportRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSupabaseService = {
    uploadFile: jest.fn(),
    downloadFile: jest.fn(),
    deleteFile: jest.fn(),
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
          provide: getRepositoryToken(ConcertAIBio),
          useValue: mockConcertAIBioRepository,
        },
        {
          provide: getRepositoryToken(VipGuest),
          useValue: mockVipGuestRepository,
        },
        {
          provide: getRepositoryToken(VipGuestImport),
          useValue: mockVipGuestImportRepository,
        },
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
        {
          provide: RabbitMQService,
          useValue: mockRabbitMQService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ConcertService>(ConcertService);
    concertRepository = module.get<Repository<Concert>>(
      getRepositoryToken(Concert),
    );
    ticketTypeRepository = module.get<Repository<TicketType>>(
      getRepositoryToken(TicketType),
    );
    concertAIBioRepository = module.get<Repository<ConcertAIBio>>(
      getRepositoryToken(ConcertAIBio),
    );
    entityManager = module.get<EntityManager>(EntityManager);
    redisService = module.get<RedisService>(RedisService);
    rabbitMQService = module.get<RabbitMQService>(RabbitMQService);
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
        ticketTypes: [{ name: 'VIP', price: 500000, totalQuantity: 100 }],
      };

      mockConcertRepository.create.mockReturnValue(dto);
      mockConcertRepository.save.mockResolvedValue({
        id: 'concert-id',
        ...dto,
      });

      mockRedisService.keys.mockResolvedValue([
        'cache:concerts:list:default:page:1:limit:10',
      ]);

      const result = await service.create(dto as any);
      expect(result).toBeDefined();
      expect(result.id).toBe('concert-id');
      expect(concertRepository.save).toHaveBeenCalled();
      expect(redisService.keys).toHaveBeenCalledWith(
        'cache:concerts:list:default:*',
      );
      expect(redisService.del).toHaveBeenCalledWith(
        'cache:concerts:list:default:page:1:limit:10',
      );
    });

    it('should throw BadRequestException if endTime <= startTime', async () => {
      const dto = {
        title: 'Rock Concert 2026',
        startTime: '2026-07-01T22:00:00Z',
        endTime: '2026-07-01T19:00:00Z',
      };

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.create(dto as any)).rejects.toThrow(
        BadRequestException,
      );
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
      expect(redisService.setex).toHaveBeenCalledWith(
        'cache:concerts:c-1',
        600,
        expect.any(String),
      );
    });

    it('should throw NotFoundException if not in DB', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockConcertRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
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
      mockConcertRepository.findOne.mockResolvedValue({
        id: 'c-1',
        svgStageMap: '<svg>Stage</svg>',
      });

      const result = await service.findStageMap('c-1');
      expect(result).toBe('<svg>Stage</svg>');
      expect(concertRepository.findOne).toHaveBeenCalled();
      expect(redisService.setex).toHaveBeenCalledWith(
        'cache:concerts:c-1:stagemap',
        1800,
        '<svg>Stage</svg>',
      );
    });
  });

  describe('findTicketTypes (Hybrid Caching)', () => {
    it('should return cached ticket types on Cache Hit and fetch quantities from Redis', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);

      const cachedTicketTypes = [
        { id: 'tt-1', name: 'VIP', price: 100, availableQuantity: 50 },
      ];
      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedTicketTypes));
      mockRedisService.mget.mockResolvedValue(['42']);

      const result = await service.findTicketTypes('c-1');
      expect(result).toBeDefined();
      expect(result[0].availableQuantity).toBe(42);
      expect(redisService.get).toHaveBeenCalledWith(
        'cache:concerts:c-1:ticket-types',
      );
      expect(redisService.mget).toHaveBeenCalledWith('inventory:c-1:tt-1');
    });

    it('should query DB, save to cache and fetch quantities from Redis on Cache Miss', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);

      mockRedisService.get.mockResolvedValue(null);
      const dbTicketTypes = [
        { id: 'tt-1', name: 'VIP', price: 100, availableQuantity: 50 },
      ];
      mockTicketTypeRepository.find.mockResolvedValue(dbTicketTypes);
      mockRedisService.mget.mockResolvedValue(['10']);

      const result = await service.findTicketTypes('c-1');
      expect(result).toBeDefined();
      expect(result[0].availableQuantity).toBe(10);
      expect(redisService.setex).toHaveBeenCalledWith(
        'cache:concerts:c-1:ticket-types',
        600,
        expect.any(String),
      );
      expect(redisService.mget).toHaveBeenCalledWith('inventory:c-1:tt-1');
    });

    it('should throw NotFoundException if concert does not exist', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);

      await expect(service.findTicketTypes('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update concert details and invalidate cache', async () => {
      const concert = {
        id: 'c-1',
        title: 'Old Title',
        startTime: new Date('2026-07-01T19:00:00Z'),
        endTime: new Date('2026-07-01T22:00:00Z'),
      };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockConcertRepository.save.mockResolvedValue({
        ...concert,
        title: 'New Title',
      });

      mockRedisService.keys.mockResolvedValue([
        'cache:concerts:list:default:page:1:limit:10',
      ]);

      const result = await service.update('c-1', { title: 'New Title' });
      expect(result.title).toBe('New Title');
      expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      expect(redisService.del).toHaveBeenCalledWith(
        'cache:concerts:c-1:stagemap',
      );
      expect(redisService.keys).toHaveBeenCalledWith(
        'cache:concerts:list:default:*',
      );
      expect(redisService.del).toHaveBeenCalledWith(
        'cache:concerts:list:default:page:1:limit:10',
      );
    });

    it('should delete old poster from Cloudinary if posterUrl changes', async () => {
      const concert = {
        id: 'c-1',
        title: 'Old Title',
        posterUrl: 'https://cloudinary.com/old.png',
        posterPublicId: 'ticketbox/posters/old_id',
        startTime: new Date('2026-07-01T19:00:00Z'),
        endTime: new Date('2026-07-01T22:00:00Z'),
      };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockConcertRepository.save.mockResolvedValue({
        ...concert,
        posterUrl: 'https://cloudinary.com/new.png',
        posterPublicId: 'ticketbox/posters/new_id',
      });
      mockRedisService.keys.mockResolvedValue([]);

      await service.update('c-1', {
        posterUrl: 'https://cloudinary.com/new.png',
        posterPublicId: 'ticketbox/posters/new_id',
      });

      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'ticketbox/posters/old_id',
      );
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

    it('should delete poster from Cloudinary when concert is removed', async () => {
      const concert = {
        id: 'c-1',
        posterPublicId: 'ticketbox/posters/some_id',
      };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockEntityManager.query.mockResolvedValue([]); // No bookings

      await service.remove('c-1');
      expect(mockCloudinaryService.deleteFile).toHaveBeenCalledWith(
        'ticketbox/posters/some_id',
      );
      expect(concertRepository.remove).toHaveBeenCalled();
    });
  });

  describe('TicketType management', () => {
    describe('createTicketType', () => {
      it('should create ticket type successfully', async () => {
        const concert = {
          id: 'c-1',
          endTime: new Date('2026-07-01T22:00:00Z'),
        };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);
        mockTicketTypeRepository.create.mockReturnValue({
          name: TicketTypeName.VIP,
          price: 100,
        });
        mockTicketTypeRepository.save.mockResolvedValue({
          id: 'tt-1',
          name: TicketTypeName.VIP,
          price: 100,
        });

        const result = await service.createTicketType('c-1', {
          name: TicketTypeName.VIP,
          price: 100,
          totalQuantity: 50,
        });
        expect(result).toBeDefined();
        expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      });

      it('should throw BadRequestException if saleStartTime >= saleEndTime', async () => {
        const concert = {
          id: 'c-1',
          endTime: new Date('2026-07-01T22:00:00Z'),
        };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);

        const dto: CreateTicketTypeDto = {
          name: TicketTypeName.VIP,
          price: 100,
          totalQuantity: 50,
          saleStartTime: '2026-07-01T20:00:00Z',
          saleEndTime: '2026-07-01T19:00:00Z',
        };

        await expect(service.createTicketType('c-1', dto)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should throw BadRequestException if saleStartTime >= concert.endTime', async () => {
        const concert = {
          id: 'c-1',
          endTime: new Date('2026-07-01T22:00:00Z'),
        };
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.findOne.mockResolvedValue(null);

        const dto: CreateTicketTypeDto = {
          name: TicketTypeName.VIP,
          price: 100,
          totalQuantity: 50,
          saleStartTime: '2026-07-01T23:00:00Z', // After concert end
        };

        await expect(service.createTicketType('c-1', dto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('updateTicketType', () => {
      it('should update ticket type and invalidate cache', async () => {
        const concert = {
          id: 'c-1',
          endTime: new Date('2026-07-01T22:00:00Z'),
        };
        const ticketType = {
          id: 'tt-1',
          concertId: 'c-1',
          name: TicketTypeName.VIP,
          totalQuantity: 50,
          availableQuantity: 50,
        };
        mockTicketTypeRepository.findOne.mockResolvedValue(ticketType);
        mockConcertRepository.findOne.mockResolvedValue(concert);
        mockTicketTypeRepository.save.mockResolvedValue({
          ...ticketType,
          price: 150,
        });

        const result = await service.updateTicketType('tt-1', { price: 150 });
        expect(result).toBeDefined();
        expect(redisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
      });
    });
  });

  describe('findAll', () => {
    it('should return cached concerts and metadata on default request Cache Hit', async () => {
      mockRedisService.get.mockResolvedValue(
        JSON.stringify({
          concerts: [{ id: 'c-1', title: 'Cached Concert' }],
          meta: { totalItems: 1, currentPage: 1 },
        }),
      );

      const result = await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        concerts: [{ id: 'c-1', title: 'Cached Concert' }],
        meta: { totalItems: 1, currentPage: 1 },
      });
      expect(redisService.get).toHaveBeenCalledWith(
        'cache:concerts:list:default:page:1:limit:10',
      );
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
      mockConcertRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

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
      expect(redisService.get).toHaveBeenCalledWith(
        'cache:concerts:list:default:page:1:limit:10',
      );
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
      mockConcertRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );

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
      expect(mockConcertRepository.createQueryBuilder).toHaveBeenCalledWith(
        'concert',
      );
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.getManyAndCount).toHaveBeenCalled();
    });
  });

  describe('generateArtistBio', () => {
    it('should throw NotFoundException if concert not found', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);
      await expect(
        service.generateArtistBio('c-1', 'u-1', Buffer.from('pdf')),
      ).rejects.toThrow(NotFoundException);
    });

    it('should parse PDF, save/update AI bio and send task to queue', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);

      const parsedText = 'Parsed biography text';
      mockGetText.mockResolvedValue({ text: parsedText });

      mockConcertAIBioRepository.findOne.mockResolvedValue(null);
      mockConcertAIBioRepository.create.mockReturnValue({
        concertId: 'c-1',
        rawText: parsedText,
      });
      mockConcertAIBioRepository.save.mockResolvedValue({
        concertId: 'c-1',
        rawText: parsedText,
        status: ConcertAIBioStatus.PROCESSING,
      });

      await service.generateArtistBio('c-1', 'u-1', Buffer.from('pdf'));

      expect(PDFParse).toHaveBeenCalledWith({ data: Buffer.from('pdf') });
      expect(mockGetText).toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalled();
      expect(mockConcertAIBioRepository.create).toHaveBeenCalledWith({
        concertId: 'c-1',
        rawText: parsedText,
      });
      expect(mockConcertAIBioRepository.save).toHaveBeenCalled();
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalledWith(
        'ai.generate_bio',
        {
          concertId: 'c-1',
          userId: 'u-1',
          rawText: parsedText,
        },
      );
    });

    it('should throw BadRequestException if PDF text parsing returns empty text', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockGetText.mockResolvedValue({ text: '  ' });

      await expect(
        service.generateArtistBio('c-1', 'u-1', Buffer.from('pdf')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if PDF parsing fails', async () => {
      const concert = { id: 'c-1' };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockGetText.mockRejectedValue(new Error('PDF error'));

      await expect(
        service.generateArtistBio('c-1', 'u-1', Buffer.from('pdf')),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('regenerateArtistBio', () => {
    it('should throw BadRequestException if no raw text is found', async () => {
      mockConcertAIBioRepository.findOne.mockResolvedValue(null);
      await expect(service.regenerateArtistBio('c-1', 'u-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should send regeneration request if raw text exists', async () => {
      const aiBio = {
        concertId: 'c-1',
        rawText: 'Existing raw text',
        status: ConcertAIBioStatus.FAILED,
        draftBio: 'old draft bio',
        error: 'old error message',
      };
      mockConcertAIBioRepository.findOne.mockResolvedValue(aiBio);
      mockConcertAIBioRepository.save.mockResolvedValue({
        ...aiBio,
        status: ConcertAIBioStatus.PROCESSING,
      });

      await service.regenerateArtistBio('c-1', 'u-1');

      expect(aiBio.status).toBe(ConcertAIBioStatus.PROCESSING);
      expect(aiBio.draftBio).toBeNull();
      expect(aiBio.error).toBeNull();
      expect(mockConcertAIBioRepository.save).toHaveBeenCalledWith(aiBio);
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalledWith(
        'ai.generate_bio',
        {
          concertId: 'c-1',
          userId: 'u-1',
          rawText: 'Existing raw text',
        },
      );
    });
  });

  describe('getArtistBio', () => {
    it('should return AI bio record if found', async () => {
      const aiBio = {
        concertId: 'c-1',
        status: ConcertAIBioStatus.COMPLETED,
        draftBio: 'Bio content',
      };
      mockConcertAIBioRepository.findOne.mockResolvedValue(aiBio);

      const result = await service.getArtistBio('c-1');
      expect(result).toEqual(aiBio);
    });

    it('should throw NotFoundException if no AI bio record exists', async () => {
      mockConcertAIBioRepository.findOne.mockResolvedValue(null);
      await expect(service.getArtistBio('c-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmArtistBio', () => {
    it('should throw NotFoundException if concert not found', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);
      await expect(
        service.confirmArtistBio('c-1', 'biography text'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update biography and invalidate cache', async () => {
      const concert = { id: 'c-1', biography: null };
      mockConcertRepository.findOne.mockResolvedValue(concert);
      mockConcertRepository.save.mockResolvedValue({
        ...concert,
        biography: 'confirmed biography',
      });
      mockRedisService.keys.mockResolvedValue([]);

      await service.confirmArtistBio('c-1', 'confirmed biography');

      expect(concert.biography).toBe('confirmed biography');
      expect(mockConcertRepository.save).toHaveBeenCalledWith(concert);
      expect(mockRedisService.del).toHaveBeenCalledWith('cache:concerts:c-1');
    });
  });

  describe('importVipGuests', () => {
    it('should throw NotFoundException if concert not found', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);
      await expect(
        service.importVipGuests('c-1', {} as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if file is missing', async () => {
      mockConcertRepository.findOne.mockResolvedValue({ id: 'c-1' });
      await expect(
        service.importVipGuests('c-1', null as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file is not a CSV', async () => {
      mockConcertRepository.findOne.mockResolvedValue({ id: 'c-1' });
      const badFile = {
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as any;
      await expect(
        service.importVipGuests('c-1', badFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully upload file, create job record and publish task to RabbitMQ', async () => {
      mockConcertRepository.findOne.mockResolvedValue({ id: 'c-1' });
      const csvFile = {
        originalname: 'guests.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('test'),
      } as any;

      mockSupabaseService.uploadFile.mockResolvedValue('path/to/uploaded/file.csv');
      mockVipGuestImportRepository.create.mockReturnValue({
        id: 'job-123',
        concertId: 'c-1',
        status: 'pending',
        fileUrl: 'path/to/uploaded/file.csv',
      });
      mockVipGuestImportRepository.save.mockResolvedValue({
        id: 'job-123',
        concertId: 'c-1',
        status: 'pending',
        fileUrl: 'path/to/uploaded/file.csv',
      });

      const result = await service.importVipGuests('c-1', csvFile);

      expect(mockSupabaseService.uploadFile).toHaveBeenCalled();
      expect(mockVipGuestImportRepository.create).toHaveBeenCalled();
      expect(mockVipGuestImportRepository.save).toHaveBeenCalled();
      expect(mockRabbitMQService.sendToQueue).toHaveBeenCalled();
      expect(result.id).toBe('job-123');
    });
  });

  describe('getVipGuestImportStatus', () => {
    it('should throw NotFoundException if import job not found', async () => {
      mockVipGuestImportRepository.findOne.mockResolvedValue(null);
      await expect(
        service.getVipGuestImportStatus('c-1', 'job-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return import job record if found', async () => {
      const job = { id: 'job-1', concertId: 'c-1', status: 'completed' };
      mockVipGuestImportRepository.findOne.mockResolvedValue(job);

      const result = await service.getVipGuestImportStatus('c-1', 'job-1');
      expect(result).toEqual(job);
    });
  });

  describe('getVipGuests', () => {
    it('should throw NotFoundException if concert not found', async () => {
      mockConcertRepository.findOne.mockResolvedValue(null);
      await expect(
        service.getVipGuests('c-1', { page: 1, limit: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated and filtered VIP guests', async () => {
      mockConcertRepository.findOne.mockResolvedValue({ id: 'c-1' });

      const guests = [
        { id: 'g-1', fullName: 'Alice', email: 'alice@example.com' },
        { id: 'g-2', fullName: 'Bob', email: 'bob@example.com' },
      ];
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([guests, 2]),
      };

      mockVipGuestRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getVipGuests('c-1', {
        search: 'Alice',
        page: 1,
        limit: 10,
      });

      expect(mockConcertRepository.findOne).toHaveBeenCalledWith({ where: { id: 'c-1' } });
      expect(mockVipGuestRepository.createQueryBuilder).toHaveBeenCalledWith('vipGuest');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('vipGuest.concertId = :concertId', { concertId: 'c-1' });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(vipGuest.fullName ILIKE :search OR vipGuest.email ILIKE :search)',
        { search: '%Alice%' },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('vipGuest.createdAt', 'DESC');
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: guests,
        meta: {
          totalItems: 2,
          itemCount: 2,
          itemsPerPage: 10,
          totalPages: 1,
          currentPage: 1,
        },
      });
    });
  });
});
