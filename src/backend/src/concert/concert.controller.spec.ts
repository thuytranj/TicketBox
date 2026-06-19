import { Test, TestingModule } from '@nestjs/testing';
import { ConcertController } from './concert.controller';
import { ConcertService } from './concert.service';
import { ConcertQueryDto } from './dto/concert-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';
import { BadRequestException } from '@nestjs/common';

describe('ConcertController', () => {
  let controller: ConcertController;
  let service: ConcertService;

  const mockConcertService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findStageMap: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createTicketType: jest.fn(),
    findTicketTypes: jest.fn(),
    generateArtistBio: jest.fn(),
    regenerateArtistBio: jest.fn(),
    getArtistBio: jest.fn(),
    confirmArtistBio: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConcertController],
      providers: [
        {
          provide: ConcertService,
          useValue: mockConcertService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ConcertController>(ConcertController);
    service = module.get<ConcertService>(ConcertService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create with DTO', async () => {
      const dto = { title: 'Test Concert' };
      mockConcertService.create.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.create(dto as any);
      expect(result).toBeDefined();
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('createTicketType', () => {
    it('should call service.createTicketType with param and DTO', async () => {
      const dto = { name: 'VIP', price: 100 };
      mockConcertService.createTicketType.mockResolvedValue({
        id: 'tt-1',
        ...dto,
      });

      const result = await controller.createTicketType('c-1', dto as any);
      expect(result).toBeDefined();
      expect(service.createTicketType).toHaveBeenCalledWith('c-1', dto);
    });
  });

  describe('uploadPoster', () => {
    it('should upload file and return Cloudinary secure URL', async () => {
      const mockFile = {
        buffer: Buffer.from('test-image'),
        mimetype: 'image/png',
      } as Express.Multer.File;

      mockCloudinaryService.uploadFile.mockResolvedValue({
        secure_url: 'https://cloudinary.com/secure.png',
        public_id: 'ticketbox/posters/test_id',
      });

      const result = await controller.uploadPoster(mockFile);
      expect(result).toEqual({
        url: 'https://cloudinary.com/secure.png',
        publicId: 'ticketbox/posters/test_id',
      });
      expect(mockCloudinaryService.uploadFile).toHaveBeenCalledWith(mockFile);
    });

    it('should throw BadRequestException if no file is provided', async () => {
      await expect(controller.uploadPoster(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with queries', async () => {
      const mockResult = { concerts: [], meta: { totalItems: 0 } };
      mockConcertService.findAll.mockResolvedValue(mockResult);

      const queryDto: ConcertQueryDto = {
        search: 'Rock',
        location: 'Hanoi',
        tag: 'music',
        status: 'active',
        page: 1,
        limit: 10,
      };

      const result = await controller.findAll(queryDto);
      expect(result).toEqual(mockResult);
      expect(service.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      mockConcertService.findOne.mockResolvedValue({ id: 'c-1' });

      const result = await controller.findOne('c-1');
      expect(result).toEqual({ id: 'c-1' });
      expect(service.findOne).toHaveBeenCalledWith('c-1');
    });
  });

  describe('findTicketTypes', () => {
    it('should call service.findTicketTypes with id', async () => {
      const mockTicketTypes = [{ id: 'tt-1', name: 'VIP', price: 100 }];
      mockConcertService.findTicketTypes.mockResolvedValue(mockTicketTypes);

      const result = await controller.findTicketTypes('c-1');
      expect(result).toEqual(mockTicketTypes);
      expect(service.findTicketTypes).toHaveBeenCalledWith('c-1');
    });
  });

  describe('findStageMap', () => {
    it('should call service.findStageMap with id and return wrapped object', async () => {
      mockConcertService.findStageMap.mockResolvedValue('<svg>Stage</svg>');

      const result = await controller.findStageMap('c-1');
      expect(result).toEqual({ svgStageMap: '<svg>Stage</svg>' });
      expect(service.findStageMap).toHaveBeenCalledWith('c-1');
    });
  });

  describe('update', () => {
    it('should call service.update with id and DTO', async () => {
      const dto = { title: 'Updated title' };
      mockConcertService.update.mockResolvedValue({ id: 'c-1', ...dto });

      const result = await controller.update('c-1', dto);
      expect(result).toBeDefined();
      expect(service.update).toHaveBeenCalledWith('c-1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove with id', async () => {
      mockConcertService.remove.mockResolvedValue(undefined);

      await controller.remove('c-1');
      expect(service.remove).toHaveBeenCalledWith('c-1');
    });
  });

  describe('generateArtistBio', () => {
    it('should upload PDF and call service.generateArtistBio', async () => {
      const mockFile = {
        buffer: Buffer.from('pdf-data'),
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      mockConcertService.generateArtistBio.mockResolvedValue(undefined);

      const result = await controller.generateArtistBio('c-1', mockFile, {
        user: { userId: 'u-1' },
      });
      expect(result).toEqual({
        message: 'PDF uploaded successfully, bio generation is in progress',
      });
      expect(service.generateArtistBio).toHaveBeenCalledWith(
        'c-1',
        'u-1',
        mockFile.buffer,
      );
    });

    it('should throw BadRequestException if no file is provided', async () => {
      await expect(
        controller.generateArtistBio('c-1', null as any, {
          user: { userId: 'u-1' },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('regenerateArtistBio', () => {
    it('should request bio regeneration and return success message', async () => {
      mockConcertService.regenerateArtistBio.mockResolvedValue(undefined);

      const result = await controller.regenerateArtistBio('c-1', {
        user: { userId: 'u-1' },
      });
      expect(result).toEqual({ message: 'Bio regeneration is in progress' });
      expect(service.regenerateArtistBio).toHaveBeenCalledWith('c-1', 'u-1');
    });
  });

  describe('getArtistBio', () => {
    it('should retrieve artist bio status and details', async () => {
      const mockBio = {
        concertId: 'c-1',
        status: 'completed',
        draftBio: 'Gemini Bio',
      };
      mockConcertService.getArtistBio.mockResolvedValue(mockBio);

      const result = await controller.getArtistBio('c-1');
      expect(result).toEqual(mockBio);
      expect(service.getArtistBio).toHaveBeenCalledWith('c-1');
    });
  });

  describe('confirmArtistBio', () => {
    it('should confirm biography and return success message', async () => {
      mockConcertService.confirmArtistBio.mockResolvedValue(undefined);

      const result = await controller.confirmArtistBio('c-1', {
        biography: 'Confirmed Bio',
      });
      expect(result).toEqual({ message: 'Biography updated successfully' });
      expect(service.confirmArtistBio).toHaveBeenCalledWith(
        'c-1',
        'Confirmed Bio',
      );
    });
  });
});
