import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { UploadMediaDto, ReviewTagDto } from './dto/media.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../shared/types';

@ApiTags('Media Pipeline')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('events/:eventId/media/upload')
  @Roles('ORGANIZATION', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload event photo or certificate and trigger AI tagging' })
  async uploadMedia(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: any,
    @Body() dto: UploadMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('A media file (photo or certificate) is required');
    }

    return this.mediaService.uploadAndProcessMedia(
      eventId,
      user.userId,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      dto,
    );
  }

  @Get('events/:eventId/media')
  @Roles('STUDENT', 'ORGANIZATION', 'ADMIN')
  @ApiOperation({ summary: 'Get all media assets and tags for an event' })
  async getEventMedia(@Param('eventId') eventId: string) {
    return this.mediaService.getEventMedia(eventId);
  }

  @Get('media/:id')
  @Roles('STUDENT', 'ORGANIZATION', 'ADMIN')
  @ApiOperation({ summary: 'Get single media asset with associated tags' })
  async getMediaDetails(@Param('id') id: string) {
    return this.mediaService.getMediaDetails(id);
  }

  @Patch('media/photo-tags/:id/review')
  @Roles('ORGANIZATION', 'ADMIN')
  @ApiOperation({ summary: 'Review and confirm/reject a photo tag' })
  async reviewPhotoTag(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewTagDto,
  ) {
    return this.mediaService.reviewPhotoTag(id, user.userId, dto);
  }

  @Patch('media/cert-tags/:id/review')
  @Roles('ORGANIZATION', 'ADMIN')
  @ApiOperation({ summary: 'Review and confirm/reject a certificate tag' })
  async reviewCertTag(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewTagDto,
  ) {
    return this.mediaService.reviewCertificateTag(id, user.userId, dto);
  }
}
