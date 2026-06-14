import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { TicketType } from './entities/ticket-type.entity';
import { ConcertService } from './concert.service';
import { ConcertController } from './concert.controller';
import { TicketTypeController } from './ticket-type.controller';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, TicketType]),
    CloudinaryModule,
  ],
  controllers: [ConcertController, TicketTypeController],
  providers: [ConcertService],
  exports: [TypeOrmModule, ConcertService],
})
export class ConcertModule {}
