import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketStatus } from '../entities/ticket.entity';

export class GetConcertTicketsDto {
  @IsOptional()
  @IsEnum(TicketStatus, {
    message: `status must be one of: ${Object.values(TicketStatus).join(', ')}`,
  })
  status?: TicketStatus;

  @IsOptional()
  @IsUUID()
  ticketTypeId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
