import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { FaceEngineService } from '../ai/face-engine.service';
import { StorageService } from '../storage/storage.service';
import { ResourceNotFoundException, BusinessValidationException } from '../shared/exceptions';
import { randomUUID } from 'crypto';

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
        faceEmbedding: true,
      },
    });

    if (!student) {
      throw new ResourceNotFoundException('StudentProfile for user', userId);
    }

    return student;
  }

  /**
   * Student registers their face:
   * 1. Generates 512-dim embedding via Face Engine
   * 2. Persists FaceEmbedding in PostgreSQL
   * 3. Sets profile status to VERIFIED
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

    // Convert file to base64 data URI
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    this.logger.log(`Generating face embedding for student ${student.id} (${student.fullName})`);

    try {
      const embedding = await this.faceEngineService.generateEmbedding(base64Data);

      if (!embedding || embedding.length === 0) {
        throw new BusinessValidationException('No face detected in reference photo');
      }

      const qdrantPointId = randomUUID();

      // Upsert face embedding entity
      const faceEmbedding = await this.prisma.faceEmbedding.upsert({
        where: { studentProfileId: student.id },
        create: {
          studentProfileId: student.id,
          qdrantPointId,
          modelVersion: 'insightface-buffalo_l-v1.3',
          dimensions: embedding.length,
          isActive: true,
        },
        update: {
          qdrantPointId,
          dimensions: embedding.length,
          isActive: true,
        },
      });

      // Update student profile status
      await this.prisma.studentProfile.update({
        where: { id: student.id },
        data: { registrationStatus: 'VERIFIED' },
      });

      this.logger.log(`Successfully verified and registered face for student ${student.id}`);

      return {
        success: true,
        registrationStatus: 'VERIFIED',
        faceEmbeddingId: faceEmbedding.id,
        qdrantPointId: faceEmbedding.qdrantPointId,
      };
    } catch (err) {
      this.logger.error(`Face registration failed: ${err.message}`);
      await this.prisma.studentProfile.update({
        where: { id: student.id },
        data: { registrationStatus: 'REJECTED' },
      });
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
      confidenceScore: tag.confidenceScore,
      status: tag.status,
      certificate: {
        ...tag.mediaAsset,
        fileSizeBytes: tag.mediaAsset.fileSizeBytes.toString(),
      },
    }));
  }
}
