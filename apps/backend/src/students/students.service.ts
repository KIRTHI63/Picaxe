import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FaceEngineService } from '../ai/face-engine.service';
import { StorageService } from '../storage/storage.service';
import { ResourceNotFoundException, BusinessValidationException } from '../shared/exceptions';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faceEngineService: FaceEngineService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Retrieves profile of current authenticated student.
   */
  async getProfile(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            displayName: true,
            credentials: { select: { email: true } },
          },
        },
        faceEmbedding: true,
      },
    });

    if (!student) {
      throw new ResourceNotFoundException('StudentProfile for user', userId);
    }

    return {
      ...student,
      email: student.user?.credentials?.[0]?.email ?? null,
    };
  }

  /**
   * Student registers their face:
   * 1. Validates single face & quality, extracts 512-D embedding, and upserts into Qdrant via Face Engine
   * 2. Saves reference image via StorageService and updates StudentProfile.avatarUrl
   * 3. Persists FaceEmbedding metadata in PostgreSQL with real qdrantPointId
   * 4. Sets profile status to VERIFIED
   */
  async registerFace(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new ResourceNotFoundException('StudentProfile for user', userId);
    }

    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    this.logger.log(`Registering face in Face Engine & Qdrant for student ${student.id} (${student.fullName})`);

    try {
      const regResult = await this.faceEngineService.registerFace(student.id, base64Data);
      const storedAvatar = await this.storageService.saveFile(file);

      const faceEmbedding = await this.prisma.faceEmbedding.upsert({
        where: { studentProfileId: student.id },
        create: {
          studentProfileId: student.id,
          qdrantPointId: regResult.qdrant_point_id!,
          modelVersion: regResult.model_version || 'buffalo_l-w600k_r50',
          dimensions: regResult.embedding_dimension || 512,
          isActive: true,
        },
        update: {
          qdrantPointId: regResult.qdrant_point_id!,
          modelVersion: regResult.model_version || 'buffalo_l-w600k_r50',
          dimensions: regResult.embedding_dimension || 512,
          isActive: true,
        },
      });

      await this.prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          registrationStatus: 'VERIFIED',
          avatarUrl: storedAvatar.publicUrl,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'FACE_REGISTERED',
          entityType: 'StudentProfile',
          entityId: student.id,
          metadata: {
            qdrantPointId: faceEmbedding.qdrantPointId,
            qualityScore: regResult.quality?.score,
          },
        },
      });

      this.logger.log(`Successfully verified and registered face for student ${student.id}`);

      return {
        success: true,
        registrationStatus: 'VERIFIED',
        faceEmbeddingId: faceEmbedding.id,
        qdrantPointId: faceEmbedding.qdrantPointId,
        avatarUrl: storedAvatar.publicUrl,
        quality: regResult.quality,
      };
    } catch (err) {
      this.logger.error(`Face registration failed: ${err.message}`);
      if (err instanceof BusinessValidationException) {
        await this.prisma.studentProfile.update({
          where: { id: student.id },
          data: { registrationStatus: 'REJECTED' },
        });
      }
      throw err;
    }
  }

  /**
   * Returns all event photos matching this student.
   */
  async getMyPhotos(userId: string) {
    const student = await this.getProfile(userId);

    const tags = await this.prisma.photoTag.findMany({
      where: {
        studentProfileId: student.id,
        status: { not: 'REJECTED' },
      },
      include: {
        mediaAsset: {
          include: {
            event: {
              select: { id: true, title: true, startDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tags.map((tag) => ({
      tagId: tag.id,
      confidenceScore: tag.confidenceScore,
      status: tag.status,
      matchType: tag.matchType,
      photo: {
        ...tag.mediaAsset,
        publicUrl: this.storageService.getPublicUrl(tag.mediaAsset.storageKey),
        fileSizeBytes: tag.mediaAsset.fileSizeBytes.toString(),
      },
    }));
  }

  /**
   * Returns all event certificates matching this student.
   */
  async getMyCertificates(userId: string) {
    const student = await this.getProfile(userId);

    const tags = await this.prisma.certificateTag.findMany({
      where: {
        studentProfileId: student.id,
        status: { not: 'REJECTED' },
      },
      include: {
        mediaAsset: {
          include: {
            event: {
              select: { id: true, title: true, startDate: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return tags.map((tag) => ({
      tagId: tag.id,
      extractedName: tag.extractedName,
      rawOcrText: tag.rawOcrText,
      confidenceScore: tag.confidenceScore,
      status: tag.status,
      certificate: {
        ...tag.mediaAsset,
        publicUrl: this.storageService.getPublicUrl(tag.mediaAsset.storageKey),
        fileSizeBytes: tag.mediaAsset.fileSizeBytes.toString(),
      },
    }));
  }
}
