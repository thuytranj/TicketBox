import {
  IsUUID,
  IsString,
  IsDateString,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OfflineLogDto {
  @IsString()
  qrCodeHash: string;

  @IsString()
  deviceId: string;

  @IsDateString()
  scanTime: string;
}

export class CheckinSyncDto {
  @IsUUID()
  concertId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfflineLogDto)
  offlineLogs: OfflineLogDto[];
}
