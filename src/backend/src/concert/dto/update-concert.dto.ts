import { IsOptional, IsString, IsArray, IsDateString, IsEnum } from 'class-validator';
import { ConcertStatus } from '../entities/concert.entity';

export class UpdateConcertDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

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

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(ConcertStatus, { message: 'Concert status is invalid' })
  status?: ConcertStatus;
}
