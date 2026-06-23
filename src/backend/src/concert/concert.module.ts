import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { TicketType } from './entities/ticket-type.entity';
import { ConcertAIBio } from './entities/concert-ai-bio.entity';
import { VipGuest } from './entities/vip-guest.entity';
import { VipGuestImport } from './entities/vip-guest-import.entity';
import { ConcertService } from './concert.service';
import { ConcertController } from './concert.controller';
import { TicketTypeController } from './ticket-type.controller';
import { CloudinaryModule } from '../common/cloudinary/cloudinary.module';
import { RabbitMQModule } from '../common/rabbitmq/rabbitmq.module';
import { SupabaseModule } from '../common/supabase/supabase.module';
import { VipGuestConsumer } from './vip-guest.consumer';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, TicketType, ConcertAIBio, VipGuest, VipGuestImport]),
    CloudinaryModule,
    RabbitMQModule,
    SupabaseModule,
  ],
  controllers: [ConcertController, TicketTypeController],
  providers: [ConcertService, VipGuestConsumer],
  exports: [TypeOrmModule, ConcertService],
})
export class ConcertModule {}
