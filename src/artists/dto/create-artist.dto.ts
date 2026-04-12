import { Transform } from 'class-transformer';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateArtistDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }
    const s = String(value).trim();
    return s === '' ? undefined : s;
  })
  @IsString()
  spotifyId?: string;
}
