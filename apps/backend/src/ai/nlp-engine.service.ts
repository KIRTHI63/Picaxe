import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  OcrResponse,
  ExtractNameResponse,
  CertificateAnalyzeResponse,
} from './interfaces/nlp-engine.interfaces';

@Injectable()
export class NlpEngineService {
  private readonly logger = new Logger(NlpEngineService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('NLP_SERVICE_URL') ||
      this.configService.get<string>('NLP_ENGINE_URL') ||
      'http://localhost:8001';
  }

  /**
   * Performs OCR text extraction on a certificate image.
   * Corresponds to POST /certificate/ocr
   */
  async extractOcrText(imageBase64: string, filename?: string): Promise<OcrResponse> {
    try {
      this.logger.log(`Calling NLP Engine OCR at ${this.baseUrl}/certificate/ocr`);
      const response = await firstValueFrom(
        this.httpService.post<OcrResponse>(
          `${this.baseUrl}/certificate/ocr`,
          { image_base64: imageBase64, filename },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to run OCR on certificate: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'NLP Engine OCR service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Extracts student candidate names from raw OCR text using Named Entity Recognition (NER).
   * Corresponds to POST /certificate/extract-name
   */
  async extractCandidateName(rawText: string): Promise<ExtractNameResponse> {
    try {
      this.logger.log(`Calling NLP Engine NER at ${this.baseUrl}/certificate/extract-name`);
      const response = await firstValueFrom(
        this.httpService.post<ExtractNameResponse>(
          `${this.baseUrl}/certificate/extract-name`,
          { raw_text: rawText },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to extract name from text: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'NLP Engine NER service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Full pipeline combining OCR, name extraction, and fuzzy score matching.
   * Corresponds to POST /certificate/analyze
   */
  async analyzeCertificate(
    imageBase64: string,
    targetName?: string,
  ): Promise<CertificateAnalyzeResponse> {
    try {
      this.logger.log(`Calling NLP Engine analysis at ${this.baseUrl}/certificate/analyze`);
      const response = await firstValueFrom(
        this.httpService.post<CertificateAnalyzeResponse>(
          `${this.baseUrl}/certificate/analyze`,
          { image_base64: imageBase64, target_name: targetName },
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to analyze certificate: ${error.response?.data?.detail || error.message}`,
      );
      throw new HttpException(
        error.response?.data?.detail || 'NLP Engine analyze service unavailable',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status?: string }>(`${this.baseUrl}/health`, {
          timeout: 2000,
        }),
      );
      return response.data?.status === 'ok';
    } catch {
      return false;
    }
  }
}
