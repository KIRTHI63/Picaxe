import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UploadMediaDto {
  @ApiProperty({ enum: ['PHOTO', 'CERTIFICATE'], description: 'Type of media being uploaded' })
  @IsEnum(['PHOTO', 'CERTIFICATE'])
  @IsNotEmpty()
  mediaType: 'PHOTO' | 'CERTIFICATE';

  @ApiPropertyOptional({ description: 'Optional target name for certificate verification' })
  @IsOptional()
  @IsString()
  targetName?: string;
}

export class ReviewTagDto {
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED'], description: 'Moderator decision on the tag' })
  @IsEnum(['CONFIRMED', 'REJECTED'])
  @IsNotEmpty()
  status: 'CONFIRMED' | 'REJECTED';
}
