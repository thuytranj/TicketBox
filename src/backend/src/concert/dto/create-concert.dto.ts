import { IsNotEmpty, IsString, IsArray, ValidateNested, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTicketTypeDto } from './create-ticket-type.dto';

export class CreateConcertDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @IsString()
  @IsNotEmpty({ message: 'Location is required' })
  location: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  posterPublicId?: string;

  @IsOptional()
  @IsString()
  biography?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  svgStageMap?: string;

  @IsDateString({}, { message: 'Start time is invalid' })
  @IsNotEmpty({ message: 'Start time is required' })
  startTime: string;

  @IsDateString({}, { message: 'End time is invalid' })
  @IsNotEmpty({ message: 'End time is required' })
  endTime: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketTypeDto)
  ticketTypes?: CreateTicketTypeDto[];
}
