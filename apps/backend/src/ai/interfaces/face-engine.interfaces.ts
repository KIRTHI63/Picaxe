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
