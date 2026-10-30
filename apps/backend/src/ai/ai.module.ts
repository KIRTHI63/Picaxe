import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FaceEngineService } from './face-engine.service';
import { NlpEngineService } from './nlp-engine.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  providers: [FaceEngineService, NlpEngineService],
  exports: [FaceEngineService, NlpEngineService],
})
export class AiModule {}
