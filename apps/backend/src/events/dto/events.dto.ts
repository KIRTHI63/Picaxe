import { IsString, IsOptional, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Tech Fest 2026' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'College-wide engineering showcase and hackathon.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Main Auditorium' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2026-11-15T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ enum: ['PUBLIC', 'PRIVATE', 'UNLISTED'], default: 'PUBLIC' })
  @IsOptional()
  @IsEnum(['PUBLIC', 'PRIVATE', 'UNLISTED'])
  visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
}
