import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FaceEngineService } from '../ai/face-engine.service';
import { NlpEngineService } from '../ai/nlp-engine.service';
import { ResourceNotFoundException } from '../shared/exceptions';
import { UploadMediaDto, ReviewTagDto } from './dto/media.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly faceEngineService: FaceEngineService,
    private readonly nlpEngineService: NlpEngineService,
  ) {}

  /**
   * Ingests a new media asset (Photo or Certificate), stores it, and triggers AI processing.
   */
  async uploadAndProcessMedia(
    eventId: string,
    uploaderUserId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    dto: UploadMediaDto,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId, deletedAt: null },
    });
    if (!event) {
      throw new ResourceNotFoundException('Event', eventId);
    }

    // 1. Store the file
    const stored = await this.storageService.saveFile(file);

    // 2. Create the MediaAsset entity in Postgres
    const mediaAsset = await this.prisma.mediaAsset.create({
      data: {
        eventId,
        uploadedByUserId: uploaderUserId,
        type: dto.mediaType,
        originalFilename: file.originalname,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        fileSizeBytes: stored.fileSizeBytes,
        uploadStatus: 'COMPLETED',
        processingStatus: 'PROCESSING',
        processingStartedAt: new Date(),
      },
    });

    this.logger.log(`Created media asset ${mediaAsset.id} (type: ${dto.mediaType})`);

    // 3. Process with AI in background / inline
    try {
      const base64Data = await this.storageService.getFileAsBase64(
        stored.storageKey,
        stored.mimeType,
      );

      if (dto.mediaType === 'PHOTO') {
        await this.processPhotoAsset(mediaAsset.id, base64Data);
      } else if (dto.mediaType === 'CERTIFICATE') {
        await this.processCertificateAsset(mediaAsset.id, base64Data, dto.targetName);
      }

      // Mark processing completed
      await this.prisma.mediaAsset.update({
        where: { id: mediaAsset.id },
        data: {
          processingStatus: 'COMPLETED',
          processingCompletedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`AI pipeline failed for asset ${mediaAsset.id}: ${err.message}`);
      await this.prisma.mediaAsset.update({
        where: { id: mediaAsset.id },
        data: {
          processingStatus: 'FAILED',
          processingError: err.message,
        },
      });
    }

    return this.getMediaDetails(mediaAsset.id);
  }

  /**
   * Face recognition pipeline for event photos.
   */
  private async processPhotoAsset(mediaAssetId: string, imageBase64: string) {
    try {
      const matches = await this.faceEngineService.searchFaces(imageBase64, 0.60, 10);
      this.logger.log(`Face Engine returned ${matches.length} matches for photo ${mediaAssetId}`);

      for (const match of matches) {
        // Resolve student profile
        const student = await this.prisma.studentProfile.findFirst({
          where: {
            OR: [
              { id: match.student_id },
              { userId: match.student_id },
              { faceEmbedding: { qdrantPointId: match.student_id } },
            ],
            deletedAt: null,
          },
        });

        if (student) {
          await this.prisma.photoTag.upsert({
            where: {
              mediaAssetId_studentProfileId: {
                mediaAssetId,
                studentProfileId: student.id,
              },
            },
            create: {
              mediaAssetId,
              studentProfileId: student.id,
              confidenceScore: match.score,
              matchType: 'AUTO',
              status: 'PENDING',
            },
            update: {
              confidenceScore: match.score,
            },
          });
          this.logger.log(`Tagged student ${student.fullName} in photo ${mediaAssetId}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Face engine search skipped: ${err.message}`);
    }
  }

  /**
   * OCR & NLP pipeline for event certificates.
   */
  private async processCertificateAsset(
    mediaAssetId: string,
    imageBase64: string,
    targetName?: string,
  ) {
    try {
      const result = await this.nlpEngineService.analyzeCertificate(imageBase64, targetName);
      const candidateName = result.extracted_name?.trim();

      if (!candidateName) return;

      // Match extracted name against students
      const students = await this.prisma.studentProfile.findMany({
        where: { deletedAt: null },
      });

      const matchedStudent = students.find(
        (s) =>
          s.fullName.toLowerCase().includes(candidateName.toLowerCase()) ||
          candidateName.toLowerCase().includes(s.fullName.toLowerCase()),
      );

      if (matchedStudent) {
        await this.prisma.certificateTag.upsert({
          where: {
            mediaAssetId_studentProfileId: {
              mediaAssetId,
              studentProfileId: matchedStudent.id,
            },
          },
          create: {
            mediaAssetId,
            studentProfileId: matchedStudent.id,
            extractedName: candidateName,
            rawOcrText: result.raw_text,
            confidenceScore: result.match_score ?? 0.9,
            matchType: 'AUTO',
            status: 'PENDING',
          },
          update: {
            extractedName: candidateName,
            rawOcrText: result.raw_text,
            confidenceScore: result.match_score ?? 0.9,
          },
        });
        this.logger.log(`Tagged certificate ${mediaAssetId} for student ${matchedStudent.fullName}`);
      }
    } catch (err) {
      this.logger.warn(`NLP certificate pipeline skipped: ${err.message}`);
    }
  }

  /**
   * Retrieves single media asset with its tags.
   */
  async getMediaDetails(mediaAssetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: mediaAssetId, deletedAt: null },
      include: {
        photoTags: {
          include: { studentProfile: true },
        },
        certificateTags: {
          include: { studentProfile: true },
        },
      },
    });

    if (!asset) {
      throw new ResourceNotFoundException('MediaAsset', mediaAssetId);
    }

    return {
      ...asset,
      fileSizeBytes: asset.fileSizeBytes.toString(), // Convert BigInt to string for JSON serialization
    };
  }

  /**
   * Retrieves all media assets for an event.
   */
  async getEventMedia(eventId: string) {
    const assets = await this.prisma.mediaAsset.findMany({
      where: { eventId, deletedAt: null },
      include: {
        photoTags: {
          include: { studentProfile: true },
        },
        certificateTags: {
          include: { studentProfile: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assets.map((a) => ({
      ...a,
      fileSizeBytes: a.fileSizeBytes.toString(),
    }));
  }

  /**
   * Reviews and confirms/rejects a photo tag.
   */
  async reviewPhotoTag(tagId: string, reviewerUserId: string, dto: ReviewTagDto) {
    const tag = await this.prisma.photoTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new ResourceNotFoundException('PhotoTag', tagId);
    }

    return this.prisma.photoTag.update({
      where: { id: tagId },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Reviews and confirms/rejects a certificate tag.
   */
  async reviewCertificateTag(tagId: string, reviewerUserId: string, dto: ReviewTagDto) {
    const tag = await this.prisma.certificateTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new ResourceNotFoundException('CertificateTag', tagId);
    }

    return this.prisma.certificateTag.update({
      where: { id: tagId },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });
  }
}
