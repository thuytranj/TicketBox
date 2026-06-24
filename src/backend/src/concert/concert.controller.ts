import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { ConcertService } from './concert.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { ConcertQueryDto } from './dto/concert-query.dto';
import { VipGuestQueryDto } from './dto/vip-guest-query.dto';
import { ConfirmArtistBioDto } from './dto/confirm-artist-bio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Controller('concerts')
export class ConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createConcertDto: CreateConcertDto) {
    return this.concertService.create(createConcertDto);
  }

  @Post('upload-poster')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return callback(
            new BadRequestException(
              'Only image files (jpg, jpeg, png, webp) are allowed!',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadPoster(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const result = await this.cloudinaryService.uploadFile(file);
    return { url: result.secure_url, publicId: result.public_id };
  }

  @Post(':concertId/ticket-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  async createTicketType(
    @Param('concertId') concertId: string,
    @Body() createTicketTypeDto: CreateTicketTypeDto,
  ) {
    return this.concertService.createTicketType(concertId, createTicketTypeDto);
  }

  @Get()
  async findAll(@Query() query: ConcertQueryDto) {
    return this.concertService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.concertService.findOne(id);
  }

  @Get(':id/ticket-types')
  async findTicketTypes(@Param('id') id: string) {
    return this.concertService.findTicketTypes(id);
  }

  @Get(':id/stagemap')
  async findStageMap(@Param('id') id: string) {
    return { svgStageMap: await this.concertService.findStageMap(id) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  async update(
    @Param('id') id: string,
    @Body() updateConcertDto: UpdateConcertDto,
  ) {
    return this.concertService.update(id, updateConcertDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.concertService.remove(id);
  }

  @Post(':id/artist-bio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Only PDF files are allowed!'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async generateArtistBio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    await this.concertService.generateArtistBio(
      id,
      req.user.userId,
      file.buffer,
    );
    return {
      message: 'PDF uploaded successfully, bio generation is in progress',
    };
  }

  @Post(':id/artist-bio/regenerate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.ACCEPTED)
  async regenerateArtistBio(@Param('id') id: string, @Request() req) {
    await this.concertService.regenerateArtistBio(id, req.user.userId);
    return { message: 'Bio regeneration is in progress' };
  }

  @Get(':id/artist-bio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  async getArtistBio(@Param('id') id: string) {
    return this.concertService.getArtistBio(id);
  }

  @Put(':id/artist-bio/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  async confirmArtistBio(
    @Param('id') id: string,
    @Body() confirmArtistBioDto: ConfirmArtistBioDto,
  ) {
    await this.concertService.confirmArtistBio(
      id,
      confirmArtistBioDto.biography,
    );
    return { message: 'Biography updated successfully' };
  }

  @Post(':id/guests/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async importVipGuests(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const job = await this.concertService.importVipGuests(id, file);
    return {
      message: 'VIP Guest list import started',
      jobId: job.id,
      status: job.status,
    };
  }

  @Get(':id/guests/imports/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @UseInterceptors(ClassSerializerInterceptor)
  async getVipGuestImportStatus(
    @Param('id') id: string,
    @Param('jobId') jobId: string,
  ) {
    return this.concertService.getVipGuestImportStatus(id, jobId);
  }

  @Get(':id/guests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  async getVipGuests(
    @Param('id') id: string,
    @Query() query: VipGuestQueryDto,
  ) {
    return this.concertService.getVipGuests(id, query);
  }
}
