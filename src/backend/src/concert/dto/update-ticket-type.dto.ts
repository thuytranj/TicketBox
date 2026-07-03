import {
  IsString,
  IsNumber,
  Min,
  IsInt,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { TicketTypeName } from '../entities/ticket-type.entity';

export class UpdateTicketTypeDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Price must be greater than or equal to 0' })
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Total quantity must be greater than 0' })
  totalQuantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Max per user must be greater than 0' })
  maxPerUser?: number;

  @IsOptional()
  @IsDateString({}, { message: 'Sale start time is invalid' })
  saleStartTime?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Sale end time is invalid' })
  saleEndTime?: string;
}
