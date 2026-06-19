import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmArtistBioDto {
  @IsString()
  @IsNotEmpty({ message: 'Biography is required' })
  biography: string;
}
