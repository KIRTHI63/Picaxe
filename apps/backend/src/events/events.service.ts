import { Injectable, Logger } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import { ResourceNotFoundException } from '../shared/exceptions';
import { CreateEventDto } from './dto/events.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private eventsRepository: EventsRepository) {}

  async listEvents() {
    const events = await this.eventsRepository.findAll();
    return events.map((ev) => {
      const mediaCount = ev.mediaAssets.length;
      const confirmedMatches = ev.mediaAssets.reduce(
        (sum, m) =>
          sum +
          m.photoTags.filter((t) => t.status !== 'REJECTED').length +
          m.certificateTags.filter((t) => t.status !== 'REJECTED').length,
        0,
      );
      const pendingReviews = ev.mediaAssets.reduce(
        (sum, m) =>
          sum +
          m.photoTags.filter((t) => t.status === 'PENDING').length +
          m.certificateTags.filter((t) => t.status === 'PENDING').length,
        0,
      );

      const { mediaAssets, ...rest } = ev;
      return {
        ...rest,
        mediaCount,
        matchCount: confirmedMatches,
        reviewNeeded: pendingReviews,
      };
    });
  }

  async createEvent(userId: string, dto: CreateEventDto) {
    const org = await this.eventsRepository.findOrCreateOrgForUser(userId);
    const created = await this.eventsRepository.create({
      organizationId: org.id,
      createdByUserId: userId,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      location: dto.location?.trim() || null,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      status: 'ACTIVE',
      visibility: dto.visibility || 'PUBLIC',
    });

    await this.eventsRepository.logEventCreated(userId, created.id, created.title);
    this.logger.log(`Created event ${created.id} (${created.title}) for org ${org.id}`);

    return {
      ...created,
      mediaCount: 0,
      matchCount: 0,
      reviewNeeded: 0,
    };
  }

  async getEventDetails(eventId: string) {
    const event = await this.eventsRepository.findById(eventId);
    if (!event) {
      throw new ResourceNotFoundException('Event', eventId);
    }

    const mediaCount = event.mediaAssets.length;
    const matchCount = event.mediaAssets.reduce(
      (sum, m) =>
        sum +
        m.photoTags.filter((t) => t.status !== 'REJECTED').length +
        m.certificateTags.filter((t) => t.status !== 'REJECTED').length,
      0,
    );
    const reviewNeeded = event.mediaAssets.reduce(
      (sum, m) =>
        sum +
        m.photoTags.filter((t) => t.status === 'PENDING').length +
        m.certificateTags.filter((t) => t.status === 'PENDING').length,
      0,
    );

    const { mediaAssets, ...rest } = event;
    return {
      ...rest,
      mediaCount,
      matchCount,
      reviewNeeded,
    };
  }
}
