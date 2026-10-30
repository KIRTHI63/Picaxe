import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../shared/types';

@ApiTags('Students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STUDENT', 'ADMIN')
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get('me/profile')
  @ApiOperation({ summary: 'Get current student profile and face verification status' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getProfile(user.userId);
  }

  @Post('me/face-registration')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload reference selfie and register biometric face embedding' })
  async registerFace(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('A clear selfie reference photo is required');
    }

    return this.studentsService.registerFace(user.userId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
  }

  @Get('me/photos')
  @ApiOperation({ summary: 'Get all event photos matched to the current student' })
  async getMyPhotos(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getMyPhotos(user.userId);
  }

  @Get('me/certificates')
  @ApiOperation({ summary: 'Get all certificates matched to the current student' })
  async getMyCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getMyCertificates(user.userId);
  }
}
