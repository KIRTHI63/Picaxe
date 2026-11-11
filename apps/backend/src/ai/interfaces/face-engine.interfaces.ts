export interface FaceEmbedRequest {
  image_base64: string;
}

export interface FaceEmbedResponse {
  embedding: number[];
}

export interface FaceSearchRequest {
  image_base64: string;
  limit?: number;
  score_threshold?: number;
}

export interface FaceSearchMatch {
  student_id: string;
  score: number;
}

export interface FaceSearchResponse {
  matches: FaceSearchMatch[];
}

export interface FaceQualityMetrics {
  valid: boolean;
  score: number;
  blur_score: number;
  brightness: number;
  face_fraction: number;
  reason?: string | null;
}

export interface FaceRegisterResponse {
  success: boolean;
  student_id: string;
  qdrant_point_id?: string | null;
  model_version: string;
  embedding_dimension: number;
  quality: FaceQualityMetrics;
  error_code?: string | null;
  detail?: string | null;
}

export interface EventFaceMatchCandidate {
  student_id: string;
  similarity: number;
  confidence_tier: 'HIGH_CONFIDENCE' | 'REVIEW' | 'DISCARD' | string;
  qdrant_point_id?: string | null;
}

export interface DetectedEventFace {
  face_index: number;
  bbox: number[];
  detection_confidence: number;
  quality: FaceQualityMetrics;
  matches: EventFaceMatchCandidate[];
}

export interface EventPhotoSearchResponse {
  total_faces_detected: number;
  faces: DetectedEventFace[];
}
