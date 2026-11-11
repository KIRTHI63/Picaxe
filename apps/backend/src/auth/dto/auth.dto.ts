import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'student@university.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Kirthi Vasan' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'University Tech' })
  @IsString()
  @IsOptional()
  institution?: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'ORGANIZATION'], default: 'STUDENT' })
  @IsOptional()
  @IsIn(['STUDENT', 'ORGANIZATION'])
  role?: 'STUDENT' | 'ORGANIZATION';

  @ApiPropertyOptional({ example: 'University Photography Club' })
  @IsOptional()
  @IsString()
  organizationName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'student@university.edu' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password!: string;
}
