import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { FaceEngineService } from '../ai/face-engine.service';
import { NlpEngineService } from '../ai/nlp-engine.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly faceEngineService: FaceEngineService,
    private readonly nlpEngineService: NlpEngineService,
  ) {}

  async getOrganizationDashboard(userId: string, role: string) {
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

    const events = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        ...(isAdmin
          ? {}
          : {
              organization: { ownerId: userId, deletedAt: null },
            }),
      },
      include: {
        organization: { select: { id: true, name: true } },
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

    const formattedEvents = events.map((ev) => {
      const mediaCount = ev.mediaAssets.length;
      const matchCount = ev.mediaAssets.reduce(
        (sum, m) =>
          sum +
          m.photoTags.filter((t) => t.status !== 'REJECTED').length +
          m.certificateTags.filter((t) => t.status !== 'REJECTED').length,
        0,
      );
      const reviewNeeded = ev.mediaAssets.reduce(
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
        matchCount,
        reviewNeeded,
      };
    });

    const eventIds = formattedEvents.map((e) => e.id);

    const [pendingPhotoTags, pendingCertTags, students, faceHealthy, nlpHealthy] = await Promise.all([
      this.prisma.photoTag.findMany({
        where: {
          status: 'PENDING',
          mediaAsset: { deletedAt: null, ...(isAdmin ? {} : { eventId: { in: eventIds } }) },
        },
        include: {
          studentProfile: {
            include: { user: { select: { credentials: { select: { email: true } } } } },
          },
          mediaAsset: {
            include: { event: { select: { id: true, title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.certificateTag.findMany({
        where: {
          status: 'PENDING',
          mediaAsset: { deletedAt: null, ...(isAdmin ? {} : { eventId: { in: eventIds } }) },
        },
        include: {
          studentProfile: {
            include: { user: { select: { credentials: { select: { email: true } } } } },
          },
          mediaAsset: {
            include: { event: { select: { id: true, title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.studentProfile.findMany({
        where: { deletedAt: null },
        include: {
          user: { select: { credentials: { select: { email: true } } } },
          photoTags: { where: { status: { not: 'REJECTED' } }, select: { id: true } },
          certificateTags: { where: { status: { not: 'REJECTED' } }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.faceEngineService.checkHealth(),
      this.nlpEngineService.checkHealth(),
    ]);

    const reviewQueue = [
      ...pendingPhotoTags.map((t) => ({
        tagId: t.id,
        tagType: 'PHOTO' as const,
        mediaId: t.mediaAssetId,
        publicUrl: this.storageService.getPublicUrl(t.mediaAsset.storageKey),
        filename: t.mediaAsset.originalFilename,
        eventId: t.mediaAsset.event.id,
        eventTitle: t.mediaAsset.event.title,
        studentId: t.studentProfileId,
        studentName: t.studentProfile.fullName,
        confidenceScore: t.confidenceScore,
        extractedName: null,
        createdAt: t.createdAt,
      })),
      ...pendingCertTags.map((t) => ({
        tagId: t.id,
        tagType: 'CERTIFICATE' as const,
        mediaId: t.mediaAssetId,
        publicUrl: this.storageService.getPublicUrl(t.mediaAsset.storageKey),
        filename: t.mediaAsset.originalFilename,
        eventId: t.mediaAsset.event.id,
        eventTitle: t.mediaAsset.event.title,
        studentId: t.studentProfileId,
        studentName: t.studentProfile.fullName,
        confidenceScore: t.confidenceScore,
        extractedName: t.extractedName,
        createdAt: t.createdAt,
      })),
    ];

    const totalMedia = formattedEvents.reduce((s, e) => s + e.mediaCount, 0);
    const totalMatches = formattedEvents.reduce((s, e) => s + e.matchCount, 0);

    return {
      stats: {
        totalEvents: formattedEvents.length,
        totalMedia,
        totalMatches,
        pendingReviews: reviewQueue.length,
        matchRate: totalMedia > 0 ? Math.round((totalMatches / totalMedia) * 100) : 0,
      },
      events: formattedEvents,
      reviewQueue,
      students: students.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.user?.credentials?.[0]?.email ?? null,
        institution: s.institution,
        registrationStatus: s.registrationStatus,
        avatarUrl: s.avatarUrl,
        matchedPhotosCount: s.photoTags.length,
        matchedCertsCount: s.certificateTags.length,
        createdAt: s.createdAt,
      })),
      servicesHealth: {
        faceEngineOnline: faceHealthy,
        nlpEngineOnline: nlpHealthy,
      },
    };
  }

  async getAdminDashboard() {
    const [
      totalUsers,
      organizations,
      events,
      mediaAssets,
      photoTagsCount,
      certTagsCount,
      rejectedPhotoTags,
      rejectedCertTags,
      auditLogs,
      faceHealthy,
      nlpHealthy,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.organization.findMany({
        where: { deletedAt: null },
        include: {
          owner: { select: { displayName: true } },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.findMany({
        where: { deletedAt: null },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          mediaAssets: {
            where: { deletedAt: null },
            select: {
              id: true,
              photoTags: { select: { id: true, status: true } },
              certificateTags: { select: { id: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.mediaAsset.findMany({
        where: { deletedAt: null },
        select: { id: true, originalFilename: true, type: true, processingStatus: true, processingError: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      this.prisma.photoTag.count(),
      this.prisma.certificateTag.count(),
      this.prisma.photoTag.count({ where: { status: 'REJECTED' } }),
      this.prisma.certificateTag.count({ where: { status: 'REJECTED' } }),
      this.prisma.auditLog.findMany({
        include: { actor: { select: { displayName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.faceEngineService.checkHealth(),
      this.nlpEngineService.checkHealth(),
    ]);

    const totalTags = photoTagsCount + certTagsCount;
    const totalRejected = rejectedPhotoTags + rejectedCertTags;
    const totalMediaAssets = await this.prisma.mediaAsset.count({ where: { deletedAt: null } });

    return {
      metrics: {
        totalUsers,
        totalOrganizations: organizations.length,
        totalEvents: events.length,
        totalMediaAssets,
        totalMatches: totalTags - totalRejected,
        correctionRate: totalTags > 0 ? Number(((totalRejected / totalTags) * 100).toFixed(1)) : 0,
      },
      servicesHealth: {
        faceEngineOnline: faceHealthy,
        nlpEngineOnline: nlpHealthy,
        databaseConnected: true,
      },
      auditLogs: auditLogs.map((l) => ({
        id: l.id,
        actorName: l.actor?.displayName || 'System',
        actorRole: l.actor?.role || 'SYSTEM',
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata,
        createdAt: l.createdAt,
      })),
      events: events.map((ev) => ({
        id: ev.id,
        title: ev.title,
        orgName: ev.organization.name,
        startDate: ev.startDate,
        status: ev.status,
        mediaCount: ev.mediaAssets.length,
        matchCount: ev.mediaAssets.reduce(
          (sum, m) =>
            sum +
            m.photoTags.filter((t) => t.status !== 'REJECTED').length +
            m.certificateTags.filter((t) => t.status !== 'REJECTED').length,
          0,
        ),
      })),
      organizations: organizations.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        ownerName: o.owner.displayName,
        eventsCount: o._count.events,
        status: o.status,
        createdAt: o.createdAt,
      })),
      recentMediaJobs: mediaAssets,
    };
  }
}
