export interface OcrRequest {
  image_base64: string;
  filename?: string;
}

export interface OcrResponse {
  raw_text: string;
  confidence: number;
}

export interface ExtractNameRequest {
  raw_text: string;
}

export interface ExtractNameResponse {
  extracted_name: string;
  confidence: number;
}

export interface CertificateAnalyzeRequest {
  image_base64: string;
  target_name?: string;
}

export interface CertificateAnalyzeResponse {
  raw_text: string;
  extracted_name: string;
  match_score?: number;
}
