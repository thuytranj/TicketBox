import { IsUUID } from 'class-validator';

export class CheckinDataQueryDto {
  @IsUUID()
  concertId: string;
}
