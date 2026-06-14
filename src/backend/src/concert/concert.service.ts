import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Concert, ConcertStatus } from './entities/concert.entity';
import { TicketType } from './entities/ticket-type.entity';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { UpdateTicketTypeDto } from './dto/update-ticket-type.dto';
import { ConcertQueryDto } from './dto/concert-query.dto';
import { RedisService } from '../common/redis/redis.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Injectable()
export class ConcertService {
  private readonly logger = new Logger(ConcertService.name);

  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    @InjectRepository(TicketType)
    private readonly ticketTypeRepository: Repository<TicketType>,
    private readonly entityManager: EntityManager,
    private readonly redisService: RedisService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private async invalidateListCache() {
    const keys = await this.redisService.keys('cache:concerts:list:default:*');
    if (keys.length > 0) {
      await this.redisService.del(...keys);
    }
  }

  private async invalidateCache(concertId: string) {
    await this.redisService.del(`cache:concerts:${concertId}`);
    await this.redisService.del(`cache:concerts:${concertId}:stagemap`);
    await this.redisService.del(`cache:concerts:${concertId}:ticket-types`);
    await this.invalidateListCache();
  }

  private validateTicketTypeSaleTimes(
    startTimeStr?: string | Date,
    endTimeStr?: string | Date,
    concertEndTime?: Date,
  ) {
    if (!startTimeStr && !endTimeStr) {
      return;
    }

    const saleStart = startTimeStr ? new Date(startTimeStr) : null;
    const saleEnd = endTimeStr ? new Date(endTimeStr) : null;

    if (saleStart && saleEnd && saleEnd <= saleStart) {
      throw new BadRequestException('Ticket sale end time must be after sale start time');
    }

    if (saleStart && concertEndTime && saleStart >= concertEndTime) {
      throw new BadRequestException('Ticket sale start time must be before the concert ends');
    }
  }

  async create(createConcertDto: CreateConcertDto): Promise<Concert> {
    const startTime = new Date(createConcertDto.startTime);
    const endTime = new Date(createConcertDto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check duplicate ticket type names if provided
    if (createConcertDto.ticketTypes && createConcertDto.ticketTypes.length > 0) {
      const names = createConcertDto.ticketTypes.map(t => t.name.trim().toLowerCase());
      const uniqueNames = new Set(names);
      if (uniqueNames.size !== names.length) {
        throw new BadRequestException('Ticket type names must be unique within a concert');
      }

      // Validate ticket type sale times
      for (const t of createConcertDto.ticketTypes) {
        this.validateTicketTypeSaleTimes(t.saleStartTime, t.saleEndTime, endTime);
      }
    }

    const concert = this.concertRepository.create({
      ...createConcertDto,
      startTime,
      endTime,
    });

    const saved = await this.concertRepository.save(concert);
    await this.invalidateListCache();
    return saved;
  }

  async findAll(filters: ConcertQueryDto): Promise<{ concerts: Concert[]; meta: any }> {
    const page = filters.page ? Math.max(1, filters.page) : 1;
    const limit = filters.limit ? Math.min(100, Math.max(1, filters.limit)) : 10;
    const offset = (page - 1) * limit;

    const isDefaultRequest = !filters.search && !filters.location && !filters.tag && !filters.status;
    const cacheKey = `cache:concerts:list:default:page:${page}:limit:${limit}`;

    if (isDefaultRequest) {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const query = this.concertRepository.createQueryBuilder('concert');

    // Exclude svg_stage_map by default for listing performance
    query.select([
      'concert.id',
      'concert.title',
      'concert.description',
      'concert.location',
      'concert.posterUrl',
      'concert.summary',
      'concert.tags',
      'concert.startTime',
      'concert.endTime',
      'concert.status',
      'concert.reminderSent',
      'concert.createdAt',
    ]);

    if (filters.status) {
      query.andWhere('concert.status = :status', { status: filters.status });
    } else {
      // Default to active status for public discovery if not specified
      query.andWhere('concert.status = :status', { status: ConcertStatus.ACTIVE });
    }

    if (filters.search) {
      query.andWhere(
        '(concert.title ILIKE :search OR concert.description ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.location) {
      query.andWhere('concert.location = :location', { location: filters.location });
    }

    if (filters.tag) {
      query.andWhere(':tag = ANY(concert.tags)', { tag: filters.tag });
    }

    query.orderBy('concert.startTime', 'ASC');

    query.skip(offset).take(limit);

    const [concerts, total] = await query.getManyAndCount();

    const result = {
      concerts,
      meta: {
        totalItems: total,
        itemCount: concerts.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };

    if (isDefaultRequest) {
      await this.redisService.setex(cacheKey, 600, JSON.stringify(result));
    }

    return result;
  }

  async findOne(id: string): Promise<Concert> {
    const cacheKey = `cache:concerts:${id}`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const concert = await this.concertRepository.findOne({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        posterUrl: true,
        summary: true,
        tags: true,
        startTime: true,
        endTime: true,
        status: true,
        reminderSent: true,
        createdAt: true,
      },
    });

    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${id}`);
    }

    // Save to Redis with 10 minutes (600s) TTL
    await this.redisService.setex(cacheKey, 600, JSON.stringify(concert));

    return concert;
  }

  async findStageMap(id: string): Promise<string> {
    const cacheKey = `cache:concerts:${id}:stagemap`;
    const cachedData = await this.redisService.get(cacheKey);

    if (cachedData !== null) {
      return cachedData;
    }

    const concert = await this.concertRepository.findOne({
      where: { id },
      select: {
        id: true,
        svgStageMap: true,
      },
    });

    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${id}`);
    }

    const svg = concert.svgStageMap || '';

    // Save to Redis with 30 minutes (1800s) TTL
    await this.redisService.setex(cacheKey, 1800, svg);

    return svg;
  }

  async findTicketTypes(concertId: string): Promise<TicketType[]> {
    const concert = await this.concertRepository.findOne({
      where: { id: concertId },
      select: { id: true },
    });
    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${concertId}`);
    }

    const cacheKey = `cache:concerts:${concertId}:ticket-types`;
    const cachedData = await this.redisService.get(cacheKey);

    let ticketTypes: TicketType[];

    if (cachedData) {
      ticketTypes = JSON.parse(cachedData);
    } else {
      ticketTypes = await this.ticketTypeRepository.find({
        where: { concertId },
        order: { price: 'ASC' },
      });
      await this.redisService.setex(cacheKey, 600, JSON.stringify(ticketTypes));
    }

    if (ticketTypes.length > 0) {
      const keys = ticketTypes.map((tt) => `inventory:${concertId}:${tt.id}`);
      const redisValues = await this.redisService.mget(...keys);
      ticketTypes = ticketTypes.map((tt, idx) => {
        const val = redisValues[idx];
        if (val !== null && val !== undefined) {
          tt.availableQuantity = parseInt(val, 10);
        }
        return tt;
      });
    }

    return ticketTypes;
  }

  async update(id: string, updateConcertDto: UpdateConcertDto): Promise<Concert> {
    const concert = await this.concertRepository.findOne({ where: { id } });
    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${id}`);
    }

    const startTime = updateConcertDto.startTime ? new Date(updateConcertDto.startTime) : concert.startTime;
    const endTime = updateConcertDto.endTime ? new Date(updateConcertDto.endTime) : concert.endTime;

    if (endTime <= startTime) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check if poster is being updated or removed, and cleanup old Cloudinary asset
    const isPosterChanged =
      updateConcertDto.posterUrl !== undefined &&
      updateConcertDto.posterUrl !== concert.posterUrl;
    const isPosterIdChanged =
      updateConcertDto.posterPublicId !== undefined &&
      updateConcertDto.posterPublicId !== concert.posterPublicId;

    if ((isPosterChanged || isPosterIdChanged) && concert.posterPublicId) {
      try {
        await this.cloudinaryService.deleteFile(concert.posterPublicId);
      } catch (err) {
        this.logger.warn(`Failed to delete old poster from Cloudinary: ${err.message}`);
      }
    }

    // Merge updates
    this.concertRepository.merge(concert, {
      ...updateConcertDto,
      startTime,
      endTime,
    });

    const updated = await this.concertRepository.save(concert);
    await this.invalidateCache(id);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const concert = await this.concertRepository.findOne({ where: { id } });
    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${id}`);
    }

    // Integrity Check: Check if bookings exist in bookings table (safe check)
    let bookingsExist = false;
    try {
      const bookings = await this.entityManager.query(
        'SELECT 1 FROM bookings WHERE concert_id = $1 LIMIT 1',
        [id],
      );
      bookingsExist = bookings && bookings.length > 0;
    } catch (error) {
      this.logger.warn(`Bookings table does not exist or query failed: ${error.message}`);
    }

    if (bookingsExist) {
      throw new BadRequestException(
        'Cannot delete concert with existing bookings. Please move concert to cancelled status.',
      );
    }

    if (concert.posterPublicId) {
      try {
        await this.cloudinaryService.deleteFile(concert.posterPublicId);
      } catch (err) {
        this.logger.warn(`Failed to delete poster from Cloudinary on concert removal: ${err.message}`);
      }
    }

    await this.concertRepository.remove(concert);
    await this.invalidateCache(id);
  }

  // --- TicketType CRUD ---

  async createTicketType(concertId: string, createDto: CreateTicketTypeDto): Promise<TicketType> {
    const concert = await this.concertRepository.findOne({ where: { id: concertId } });
    if (!concert) {
      throw new NotFoundException(`Not found concert with id: ${concertId}`);
    }

    // Check if name already exists in this concert (unique key constraint)
    const existing = await this.ticketTypeRepository.findOne({
      where: { concertId, name: createDto.name },
    });
    if (existing) {
      throw new BadRequestException(`Concert already has ticket type with name "${createDto.name}"`);
    }

    // Validate sale times
    this.validateTicketTypeSaleTimes(createDto.saleStartTime, createDto.saleEndTime, concert.endTime);

    const ticketType = this.ticketTypeRepository.create({
      ...createDto,
      concertId,
      availableQuantity: createDto.totalQuantity,
    });

    const saved = await this.ticketTypeRepository.save(ticketType);
    await this.invalidateCache(concertId);
    return saved;
  }

  async updateTicketType(id: string, updateDto: UpdateTicketTypeDto): Promise<TicketType> {
    const ticketType = await this.ticketTypeRepository.findOne({ where: { id } });
    if (!ticketType) {
      throw new NotFoundException(`Not found ticket type with id: ${id}`);
    }

    // Unique check if name changes
    if (updateDto.name && updateDto.name !== ticketType.name) {
      const existing = await this.ticketTypeRepository.findOne({
        where: { concertId: ticketType.concertId, name: updateDto.name },
      });
      if (existing) {
        throw new BadRequestException(`Ticket type name "${updateDto.name}" already exists in this concert`);
      }
    }

    // Validate sale times
    const concert = await this.concertRepository.findOne({ where: { id: ticketType.concertId } });
    const saleStart = updateDto.saleStartTime !== undefined ? updateDto.saleStartTime : ticketType.saleStartTime;
    const saleEnd = updateDto.saleEndTime !== undefined ? updateDto.saleEndTime : ticketType.saleEndTime;
    this.validateTicketTypeSaleTimes(saleStart, saleEnd, concert?.endTime);

    // Handle quantity updates safely
    if (updateDto.totalQuantity !== undefined) {
      const diff = updateDto.totalQuantity - ticketType.totalQuantity;
      const newAvailable = ticketType.availableQuantity + diff;
      if (newAvailable < 0) {
        throw new BadRequestException('The new total quantity makes the available quantity less than 0');
      }
      ticketType.availableQuantity = newAvailable;
    }

    this.ticketTypeRepository.merge(ticketType, updateDto);
    const saved = await this.ticketTypeRepository.save(ticketType);
    await this.invalidateCache(ticketType.concertId);
    return saved;
  }

  async removeTicketType(id: string): Promise<void> {
    const ticketType = await this.ticketTypeRepository.findOne({ where: { id } });
    if (!ticketType) {
      throw new NotFoundException(`Not found ticket type with id: ${id}`);
    }

    // Check if any tickets have been issued (ref: tickets table - safe check)
    let ticketsExist = false;
    try {
      const tickets = await this.entityManager.query(
        'SELECT 1 FROM tickets WHERE ticket_type_id = $1 LIMIT 1',
        [id],
      );
      ticketsExist = tickets && tickets.length > 0;
    } catch (error) {
      this.logger.warn(`Tickets table does not exist or query failed: ${error.message}`);
    }

    if (ticketsExist) {
      throw new BadRequestException('Cannot delete ticket type with existing tickets');
    }

    await this.ticketTypeRepository.remove(ticketType);
    await this.invalidateCache(ticketType.concertId);
  }
}
