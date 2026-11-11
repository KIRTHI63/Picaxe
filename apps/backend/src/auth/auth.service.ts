import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BusinessValidationException } from '../shared/exceptions';
import { JwtPayload } from '../shared/types';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { credentials: { some: { email: dto.email } }, deletedAt: null },
    });
    if (existingUser) {
      throw new BusinessValidationException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const targetRole = dto.role === 'ORGANIZATION' ? 'ORGANIZATION' : 'STUDENT';
    const orgName = (dto.organizationName || dto.institution || `${dto.name} Organization`).trim();
    const orgSlug = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'org'}-${Date.now().toString(36)}`;

    const user = await this.prisma.user.create({
      data: {
        displayName: dto.name,
        role: targetRole,
        credentials: {
          create: {
            provider: 'EMAIL',
            providerId: dto.email,
            email: dto.email,
            passwordHash: hashedPassword,
          },
        },
        ...(targetRole === 'STUDENT'
          ? {
              studentProfile: {
                create: {
                  fullName: dto.name,
                  institution: dto.institution,
                },
              },
            }
          : {
              ownedOrgs: {
                create: {
                  name: orgName,
                  slug: orgSlug,
                  status: 'ACTIVE',
                },
              },
            }),
      },
      include: {
        studentProfile: true,
        ownedOrgs: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        metadata: { role: targetRole, email: dto.email },
      },
    });

    this.logger.log(`Registered new ${targetRole} user: ${user.id}`);
    return this.generateTokens(user.id, user.role, user.displayName, dto.email);
  }

  async login(dto: LoginDto) {
    const creds = await this.prisma.userCredential.findFirst({
      where: { email: dto.email, provider: 'EMAIL' },
      include: { user: true },
    });

    if (!creds || !creds.passwordHash || creds.user.deletedAt) {
      throw new BusinessValidationException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, creds.passwordHash);
    if (!isMatch) {
      throw new BusinessValidationException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: creds.userId },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${creds.userId}`);
    return this.generateTokens(creds.userId, creds.user.role, creds.user.displayName, creds.email);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        credentials: { select: { email: true, provider: true } },
        studentProfile: { include: { faceEmbedding: true } },
        ownedOrgs: { where: { deletedAt: null } },
      },
    });

    if (!user) {
      throw new BusinessValidationException('User account not found');
    }

    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      email: user.credentials[0]?.email ?? null,
      studentProfile: user.studentProfile,
      organizations: user.ownedOrgs,
    };
  }

  private async generateTokens(userId: string, role: string, displayName?: string, email?: string) {
    const payload: JwtPayload = { sub: userId, role };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: userId,
        displayName,
        email,
        role,
      },
    };
  }
}
