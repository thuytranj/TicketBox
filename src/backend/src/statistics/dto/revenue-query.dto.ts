import { IsOptional, IsIn, IsDateString } from 'class-validator';

export class RevenueQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month' = 'day';

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
