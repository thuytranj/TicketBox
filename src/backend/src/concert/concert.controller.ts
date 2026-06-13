import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ConcertService } from './concert.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('concerts')
export class ConcertController {
  constructor(private readonly concertService: ConcertService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createConcertDto: CreateConcertDto) {
    return this.concertService.create(createConcertDto);
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
  async findAll(
    @Query('search') search?: string,
    @Query('location') location?: string,
    @Query('tag') tag?: string,
    @Query('status') status?: string,
  ) {
    return this.concertService.findAll({ search, location, tag, status });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.concertService.findOne(id);
  }

  @Get(':id/stagemap')
  async findStageMap(@Param('id') id: string) {
    return { svgStageMap: await this.concertService.findStageMap(id) };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  async update(@Param('id') id: string, @Body() updateConcertDto: UpdateConcertDto) {
    return this.concertService.update(id, updateConcertDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.concertService.remove(id);
  }
}
