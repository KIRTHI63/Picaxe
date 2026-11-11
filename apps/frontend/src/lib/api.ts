'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'picaxe_access_token';
const USER_KEY = 'picaxe_user';

export interface AuthUser {
  id: string;
  displayName?: string | null;
  email?: string | null;
  role: 'STUDENT' | 'ORGANIZATION' | 'ADMIN' | 'SUPER_ADMIN' | string;
}

export interface EventRecord {
  id: string;
  organizationId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: string;
  status: string;
  visibility: string;
  mediaCount: number;
  matchCount: number;
  reviewNeeded: number;
  organization?: { id: string; name: string; slug?: string };
}

export interface MediaTagRecord {
  id: string;
  studentProfileId: string;
  confidenceScore: number;
  matchType: string;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  extractedName?: string;
  rawOcrText?: string | null;
  studentProfile?: {
    id: string;
    fullName: string;
    institution?: string | null;
    avatarUrl?: string | null;
  };
}

export interface MediaAssetRecord {
  id: string;
  eventId: string;
  type: 'PHOTO' | 'CERTIFICATE';
  originalFilename: string;
  storageKey: string;
  publicUrl: string;
  mimeType: string;
  fileSizeBytes: string;
  uploadStatus: string;
  processingStatus: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  processingError?: string | null;
  createdAt: string;
  photoTags?: MediaTagRecord[];
  certificateTags?: MediaTagRecord[];
  aiSummary?: Record<string, unknown>;
}

export interface ReviewQueueItem {
  tagId: string;
  tagType: 'PHOTO' | 'CERTIFICATE';
  mediaId: string;
  publicUrl: string;
  filename: string;
  eventId: string;
  eventTitle: string;
  studentId: string;
  studentName: string;
  confidenceScore: number;
  extractedName?: string | null;
  createdAt: string;
}

export interface StudentListItem {
  id: string;
  fullName: string;
  email?: string | null;
  institution?: string | null;
  registrationStatus: 'PENDING' | 'FACE_UPLOADED' | 'VERIFIED' | 'REJECTED';
  avatarUrl?: string | null;
  matchedPhotosCount: number;
  matchedCertsCount: number;
  createdAt: string;
}

export interface OrganizationDashboardData {
  stats: {
    totalEvents: number;
    totalMedia: number;
    totalMatches: number;
    pendingReviews: number;
    matchRate: number;
  };
  events: EventRecord[];
  reviewQueue: ReviewQueueItem[];
  students: StudentListItem[];
  servicesHealth: {
    faceEngineOnline: boolean;
    nlpEngineOnline: boolean;
  };
}

export interface AdminDashboardData {
  metrics: {
    totalUsers: number;
    totalOrganizations: number;
    totalEvents: number;
    totalMediaAssets: number;
    totalMatches: number;
    correctionRate: number;
  };
  servicesHealth: {
    faceEngineOnline: boolean;
    nlpEngineOnline: boolean;
    databaseConnected: boolean;
  };
  auditLogs: Array<{
    id: string;
    actorName: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    title: string;
    orgName: string;
    startDate: string;
    status: string;
    mediaCount: number;
    matchCount: number;
  }>;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    ownerName: string;
    eventsCount: number;
    status: string;
    createdAt: string;
  }>;
  recentMediaJobs: Array<{
    id: string;
    originalFilename: string;
    type: 'PHOTO' | 'CERTIFICATE';
    processingStatus: string;
    processingError?: string | null;
    createdAt: string;
  }>;
}

export interface StudentProfileData {
  id: string;
  userId: string;
  fullName: string;
  email?: string | null;
  institution?: string | null;
  studentCode?: string | null;
  avatarUrl?: string | null;
  registrationStatus: 'PENDING' | 'FACE_UPLOADED' | 'VERIFIED' | 'REJECTED';
  faceEmbedding?: {
    id: string;
    qdrantPointId: string;
    modelVersion: string;
    dimensions: number;
    isActive: boolean;
  } | null;
}

export interface StudentMatchedPhoto {
  tagId: string;
  confidenceScore: number;
  status: string;
  matchType: string;
  photo: {
    id: string;
    eventId: string;
    originalFilename: string;
    publicUrl: string;
    createdAt: string;
    event: { id: string; title: string; startDate: string };
  };
}

export interface StudentMatchedCertificate {
  tagId: string;
  extractedName: string;
  rawOcrText?: string | null;
  confidenceScore: number;
  status: string;
  certificate: {
    id: string;
    eventId: string;
    originalFilename: string;
    publicUrl: string;
    createdAt: string;
    event: { id: string; title: string; startDate: string };
  };
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('accessToken');
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(accessToken: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('picaxe_auth_changed'));
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('accessToken');
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('picaxe_auth_changed'));
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthSession();
    }
    const msg = Array.isArray(json?.message)
      ? json.message.join(', ')
      : json?.message || json?.detail || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  auth: {
    async login(body: { email: string; password: string }) {
      const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuthSession(data.accessToken, data.user);
      return data;
    },
    async register(body: {
      email: string;
      password: string;
      name: string;
      institution?: string;
      role?: 'STUDENT' | 'ORGANIZATION';
      organizationName?: string;
    }) {
      const data = await apiFetch<{ accessToken: string; user: AuthUser }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setAuthSession(data.accessToken, data.user);
      return data;
    },
    async me() {
      return apiFetch<AuthUser & { studentProfile?: StudentProfileData; organizations?: any[] }>('/auth/me');
    },
    logout() {
      clearAuthSession();
    },
  },
  events: {
    list() {
      return apiFetch<EventRecord[]>('/events');
    },
    getById(id: string) {
      return apiFetch<EventRecord>(`/events/${encodeURIComponent(id)}`);
    },
    create(body: {
      title: string;
      description?: string;
      location?: string;
      startDate?: string;
      visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
    }) {
      return apiFetch<EventRecord>('/events', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
  media: {
    upload(eventId: string, file: File, mediaType: 'PHOTO' | 'CERTIFICATE', targetName?: string) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mediaType', mediaType);
      if (targetName) formData.append('targetName', targetName);
      return apiFetch<MediaAssetRecord>(`/events/${encodeURIComponent(eventId)}/media/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    getEventMedia(eventId: string) {
      return apiFetch<MediaAssetRecord[]>(`/events/${encodeURIComponent(eventId)}/media`);
    },
    reviewPhotoTag(tagId: string, status: 'CONFIRMED' | 'REJECTED') {
      return apiFetch(`/media/photo-tags/${encodeURIComponent(tagId)}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
    reviewCertTag(tagId: string, status: 'CONFIRMED' | 'REJECTED') {
      return apiFetch(`/media/cert-tags/${encodeURIComponent(tagId)}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
  },
  students: {
    getMyProfile() {
      return apiFetch<StudentProfileData>('/students/me/profile');
    },
    registerFace(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{
        success: boolean;
        registrationStatus: string;
        qdrantPointId: string;
        avatarUrl: string;
        quality?: {
          valid: boolean;
          score: number;
          blur_score: number;
          brightness: number;
          face_fraction: number;
        };
      }>('/students/me/face-registration', {
        method: 'POST',
        body: formData,
      });
    },
    getMyPhotos() {
      return apiFetch<StudentMatchedPhoto[]>('/students/me/photos');
    },
    getMyCertificates() {
      return apiFetch<StudentMatchedCertificate[]>('/students/me/certificates');
    },
  },
  dashboard: {
    getOrganizationDashboard() {
      return apiFetch<OrganizationDashboardData>('/organization/dashboard');
    },
    getAdminDashboard() {
      return apiFetch<AdminDashboardData>('/admin/dashboard');
    },
  },
};
