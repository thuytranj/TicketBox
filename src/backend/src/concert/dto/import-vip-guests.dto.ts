import { IsNotEmpty, IsString, IsEmail, IsOptional } from 'class-validator';

export class VipGuestRowDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  affiliateCompany?: string;
}
