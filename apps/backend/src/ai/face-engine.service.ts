import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { BusinessValidationException } from '../shared/exceptions';
import {
  EventPhotoSearchResponse,
  FaceEmbedResponse,
  FaceRegisterResponse,
  FaceSearchMatch,
  FaceSearchResponse,
} from './interfaces/face-engine.interfaces';

@Injectable()
export class FaceEngineService {
  private readonly logger = new Logger(FaceEngineService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('aiService.url') ||
      this.configService.get<string>('AI_SERVICE_URL') ||
      'http://localhost:8000';
  }

  /**
   * Registers a student's face in the Face Engine + Qdrant vector DB.
   * Performs single-face check, quality check, 512-D ArcFace embedding, and Qdrant upsert.
   */
  async registerFace(studentId: string, imageBase64: string): Promise<FaceRegisterResponse> {
    try {
      this.logger.log(`Calling Face Engine /face/register for student ${studentId}`);
      const response = await firstValueFrom(
        this.httpService.post<FaceRegisterResponse>(
          `${this.baseUrl}/face/register`,
          { student_id: studentId, image_base64: imageBase64 },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const data = response.data;
      if (!data.success || !data.qdrant_point_id) {
        throw new BusinessValidationException(
          data.detail || `Face validation failed (${data.error_code || 'INVALID_FACE'})`,
        );
      }

      return data;
    } catch (error) {
      if (error instanceof BusinessValidationException) {
        throw error;
      }
      const status = error.response?.status;
      const detail = error.response?.data?.detail;
      if (status && status >= 400 && status < 500) {
        throw new BusinessValidationException(detail || 'Face registration image rejected by Face Engine');
      }
      this.logger.error(`Face Engine register unavailable: ${detail || error.message}`);
      throw new HttpException(
        detail || 'Face Engine service unavailable',
        status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Generates a 512-dimensional vector embedding from a base64-encoded face image.
   * Corresponds to POST /face/embed
   */
  async generateEmbedding(imageBase64: string): Promise<number[]> {
    try {
      this.logger.log(`Calling Face Engine to generate embedding at ${this.baseUrl}/face/embed`);
      const response = await firstValueFrom(
        this.httpService.post<FaceEmbedResponse>(
          `${this.baseUrl}/face/embed`,
          { image_base64: imageBase64 },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data.embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate face embedding: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'Face Engine service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Multi-face detection + Qdrant ANN search for event photos.
   * Corresponds to POST /face/search-event
   */
  async searchEventFaces(
    imageBase64: string,
    scoreThreshold = 0.52,
    limitPerFace = 5,
  ): Promise<EventPhotoSearchResponse> {
    try {
      this.logger.log(`Calling Face Engine /face/search-event at ${this.baseUrl}`);
      const response = await firstValueFrom(
        this.httpService.post<EventPhotoSearchResponse>(
          `${this.baseUrl}/face/search-event`,
          {
            image_base64: imageBase64,
            score_threshold: scoreThreshold,
            limit_per_face: limitPerFace,
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to search event faces: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'Face Engine search service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Searches Qdrant for matching student face embeddings (flat format).
   * Corresponds to POST /face/search
   */
  async searchFaces(
    imageBase64: string,
    scoreThreshold = 0.52,
    limit = 10,
  ): Promise<FaceSearchMatch[]> {
    try {
      this.logger.log(`Calling Face Engine to search faces at ${this.baseUrl}/face/search`);
      const response = await firstValueFrom(
        this.httpService.post<FaceSearchResponse>(
          `${this.baseUrl}/face/search`,
          {
            image_base64: imageBase64,
            score_threshold: scoreThreshold,
            limit,
          },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data.matches || [];
    } catch (error) {
      this.logger.error(
        `Failed to search faces in Face Engine: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'Face Engine search service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status?: string; model_loaded?: boolean }>(`${this.baseUrl}/health`, {
          timeout: 2000,
        }),
      );
      return Boolean(response.data?.status && response.data.status !== 'unhealthy');
    } catch {
      return false;
    }
  }
}
