import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class EventsRepository {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.event.findMany({
      where: { deletedAt: null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        mediaAssets: {
          where: { deletedAt: null },
          select: {
            id: true,
            processingStatus: true,
            photoTags: { select: { id: true, status: true } },
            certificateTags: { select: { id: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.event.findUnique({
      where: { id, deletedAt: null },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        mediaAssets: {
          where: { deletedAt: null },
          select: {
            id: true,
            type: true,
            processingStatus: true,
            photoTags: { select: { id: true, status: true, studentProfileId: true } },
            certificateTags: { select: { id: true, status: true, studentProfileId: true } },
          },
        },
      },
    });
  }

  async findOrCreateOrgForUser(userId: string) {
    const existing = await this.prisma.organization.findFirst({
      where: { ownerId: userId, deletedAt: null },
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const name = `${user?.displayName || 'Picaxe'} Organization`;
    const slug = `org-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

    return this.prisma.organization.create({
      data: {
        ownerId: userId,
        name,
        slug,
        status: 'ACTIVE',
      },
    });
  }

  async create(data: any) {
    return this.prisma.event.create({
      data,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async logEventCreated(userId: string, eventId: string, title: string) {
    return this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'EVENT_CREATED',
        entityType: 'Event',
        entityId: eventId,
        metadata: { title },
      },
    });
  }
}
