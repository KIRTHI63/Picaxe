import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  FaceEmbedResponse,
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
   * Searches Qdrant for matching student face embeddings.
   * Corresponds to POST /face/search
   */
  async searchFaces(
    imageBase64: string,
    scoreThreshold = 0.65,
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
}
