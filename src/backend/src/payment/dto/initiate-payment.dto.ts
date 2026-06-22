import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsOptional()
  orderInfo?: string;
}
