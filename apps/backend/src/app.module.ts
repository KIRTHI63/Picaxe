import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { AiModule } from './ai/ai.module';
import { StorageModule } from './storage/storage.module';
import { MediaModule } from './media/media.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    // Configuration initialized globally
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    // Global database module
    DatabaseModule,

    // Storage & Media Pipeline
    StorageModule,
    MediaModule,

    // Feature Modules
    AuthModule,
    EventsModule,
    StudentsModule,

    // AI Microservices Integration
    AiModule,
  ],
})
export class AppModule {}
