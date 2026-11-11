import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface StoredFileResult {
  storageKey: string;
  publicUrl: string;
  fileSizeBytes: bigint;
  mimeType: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private readonly configService: ConfigService) {
    // Default to local directory in project
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
  }

  async onModuleInit() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Initialized local media storage directory at: ${this.uploadDir}`);
    } catch (err) {
      this.logger.error(`Failed to create uploads directory: ${err.message}`);
    }
  }

  /**
   * Saves a buffer to storage (local disk for development).
   */
  async saveFile(file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }): Promise<StoredFileResult> {
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${Date.now()}-${randomUUID()}-${sanitizedName}`;
    const filePath = path.join(this.uploadDir, storageKey);

    await fs.writeFile(filePath, file.buffer);

    return {
      storageKey,
      publicUrl: this.getPublicUrl(storageKey),
      fileSizeBytes: BigInt(file.buffer.length),
      mimeType: file.mimetype,
    };
  }

  /**
   * Builds the public URL for a stored media asset.
   */
  getPublicUrl(storageKey: string): string {
    const publicBaseUrl =
      this.configService.get<string>('storage.publicBaseUrl') || 'http://localhost:3001/uploads';
    return `${publicBaseUrl}/${storageKey}`;
  }

  /**
   * Reads a stored file and converts it into a base64 Data URI string
   * formatted for the Face Engine & NLP Engine contracts.
   */
  async getFileAsBase64(storageKey: string, mimeType = 'image/jpeg'): Promise<string> {
    const filePath = path.join(this.uploadDir, storageKey);
    const buffer = await fs.readFile(filePath);
    const base64Data = buffer.toString('base64');
    return `data:${mimeType};base64,${base64Data}`;
  }

  /**
   * Deletes a file from storage.
   */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, storageKey);
      await fs.unlink(filePath);
    } catch (err) {
      this.logger.warn(`Could not delete file ${storageKey}: ${err.message}`);
    }
  }
}
