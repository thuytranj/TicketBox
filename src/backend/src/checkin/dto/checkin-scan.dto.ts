import { IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class CheckinScanDto {
  @IsUUID()
  concertId: string;

  @IsString()
  qrCodeHash: string;

  @IsString()
  deviceId: string;

  @IsOptional()
  @IsDateString()
  scanTime?: string;
}
