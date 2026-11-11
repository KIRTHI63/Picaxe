import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FaceEngineService } from '../ai/face-engine.service';
import { NlpEngineService } from '../ai/nlp-engine.service';
import { ResourceNotFoundException } from '../shared/exceptions';
import { UploadMediaDto, ReviewTagDto } from './dto/media.dto';

function normalizeName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Computes normalized Levenshtein similarity in [0, 1]. */
function nameSimilarityRatio(aRaw: string, bRaw: string): number {
  const a = normalizeName(aRaw);
  const b = normalizeName(bRaw);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return 1 - dp[m][n] / Math.max(m, n);
}

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
   * Ingests a new media asset (Photo or Certificate), stores it, and triggers real AI processing.
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

    const stored = await this.storageService.saveFile(file);

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

    let aiSummary: Record<string, unknown> = {};

    try {
      const base64Data = await this.storageService.getFileAsBase64(
        stored.storageKey,
        stored.mimeType,
      );

      if (dto.mediaType === 'PHOTO') {
        aiSummary = await this.processPhotoAsset(mediaAsset.id, base64Data);
      } else if (dto.mediaType === 'CERTIFICATE') {
        aiSummary = await this.processCertificateAsset(mediaAsset.id, base64Data, dto.targetName);
      }

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
      aiSummary = { error: err.message };
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: uploaderUserId,
        action: 'MEDIA_UPLOADED',
        entityType: 'MediaAsset',
        entityId: mediaAsset.id,
        metadata: {
          eventId,
          mediaType: dto.mediaType,
          filename: file.originalname,
          ...aiSummary,
        },
      },
    });

    const details = await this.getMediaDetails(mediaAsset.id);
    return {
      ...details,
      aiSummary,
    };
  }

  /**
   * Face recognition pipeline for event photos via Face Engine (/face/search-event).
   */
  private async processPhotoAsset(mediaAssetId: string, imageBase64: string) {
    const result = await this.faceEngineService.searchEventFaces(imageBase64, 0.52, 5);
    const bestMatchPerStudent = new Map<string, number>();

    for (const face of result.faces || []) {
      const topMatch = face.matches?.[0];
      if (!topMatch?.student_id) continue;
      const prev = bestMatchPerStudent.get(topMatch.student_id) ?? 0;
      if (topMatch.similarity > prev) {
        bestMatchPerStudent.set(topMatch.student_id, topMatch.similarity);
      }
    }

    let tagsCreated = 0;
    for (const [matchedStudentId, similarity] of bestMatchPerStudent.entries()) {
      const student = await this.prisma.studentProfile.findFirst({
        where: {
          OR: [
            { id: matchedStudentId },
            { userId: matchedStudentId },
            { faceEmbedding: { qdrantPointId: matchedStudentId } },
          ],
          deletedAt: null,
        },
      });

      if (student) {
        const status = similarity >= 0.65 ? 'CONFIRMED' : 'PENDING';
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
            confidenceScore: similarity,
            matchType: 'AUTO',
            status,
          },
          update: {
            confidenceScore: similarity,
            status,
          },
        });
        tagsCreated++;
        this.logger.log(
          `Tagged student ${student.fullName} in photo ${mediaAssetId} (score: ${similarity}, status: ${status})`,
        );
      }
    }

    return {
      totalFacesDetected: result.total_faces_detected ?? 0,
      tagsCreated,
    };
  }

  /**
   * OCR & NLP pipeline for event certificates via NLP Engine (/certificate/analyze).
   */
  private async processCertificateAsset(
    mediaAssetId: string,
    imageBase64: string,
    targetName?: string,
  ) {
    const result = await this.nlpEngineService.analyzeCertificate(imageBase64, targetName);
    const candidateName = result.extracted_name?.trim() || null;

    if (!candidateName) {
      this.logger.log(`No recipient name extracted from certificate ${mediaAssetId}`);
      return {
        extractedName: null,
        rawOcrText: result.raw_text || '',
        matchedStudentId: null,
      };
    }

    const students = await this.prisma.studentProfile.findMany({
      where: { deletedAt: null },
    });

    let bestStudent: (typeof students)[number] | null = null;
    let bestScore = 0;

    for (const student of students) {
      const ratio = nameSimilarityRatio(candidateName, student.fullName);
      if (ratio > bestScore) {
        bestScore = ratio;
        bestStudent = student;
      }
    }

    // Only match when fuzzy similarity is genuinely >= 0.80
    if (bestStudent && bestScore >= 0.8) {
      const confidence = result.match_score ?? Number(bestScore.toFixed(4));
      const status = confidence >= 0.9 ? 'CONFIRMED' : 'PENDING';

      await this.prisma.certificateTag.upsert({
        where: {
          mediaAssetId_studentProfileId: {
            mediaAssetId,
            studentProfileId: bestStudent.id,
          },
        },
        create: {
          mediaAssetId,
          studentProfileId: bestStudent.id,
          extractedName: candidateName,
          rawOcrText: result.raw_text,
          confidenceScore: confidence,
          matchType: 'AUTO',
          status,
        },
        update: {
          extractedName: candidateName,
          rawOcrText: result.raw_text,
          confidenceScore: confidence,
          status,
        },
      });

      this.logger.log(
        `Tagged certificate ${mediaAssetId} for ${bestStudent.fullName} (extracted: "${candidateName}", score: ${confidence}, status: ${status})`,
      );

      return {
        extractedName: candidateName,
        rawOcrText: result.raw_text || '',
        matchedStudentId: bestStudent.id,
        matchedStudentName: bestStudent.fullName,
        confidenceScore: confidence,
        status,
      };
    }

    this.logger.log(
      `Certificate ${mediaAssetId} extracted "${candidateName}" — no registered student matched >= 0.80`,
    );

    return {
      extractedName: candidateName,
      rawOcrText: result.raw_text || '',
      matchedStudentId: null,
      bestSimilarity: Number(bestScore.toFixed(4)),
    };
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
      publicUrl: this.storageService.getPublicUrl(asset.storageKey),
      fileSizeBytes: asset.fileSizeBytes.toString(),
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
      publicUrl: this.storageService.getPublicUrl(a.storageKey),
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

    const updated = await this.prisma.photoTag.update({
      where: { id: tagId },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerUserId,
        action: dto.status === 'CONFIRMED' ? 'APPROVE_PHOTO_TAG' : 'REJECT_PHOTO_TAG',
        entityType: 'PhotoTag',
        entityId: tagId,
        metadata: { from: tag.status, to: dto.status },
      },
    });

    return updated;
  }

  /**
   * Reviews and confirms/rejects a certificate tag.
   */
  async reviewCertificateTag(tagId: string, reviewerUserId: string, dto: ReviewTagDto) {
    const tag = await this.prisma.certificateTag.findUnique({ where: { id: tagId } });
    if (!tag) {
      throw new ResourceNotFoundException('CertificateTag', tagId);
    }

    const updated = await this.prisma.certificateTag.update({
      where: { id: tagId },
      data: {
        status: dto.status,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerUserId,
        action: dto.status === 'CONFIRMED' ? 'APPROVE_CERT_TAG' : 'REJECT_CERT_TAG',
        entityType: 'CertificateTag',
        entityId: tagId,
        metadata: { from: tag.status, to: dto.status },
      },
    });

    return updated;
  }
}
