export interface GenerationRequest {
  sceneCount: number;
  description: string;
  characterImage: File | string;
  includeMusic?: boolean;
}

export interface GenerationResponse {
  sessionId: string;
  status: 'started' | 'completed' | 'failed';
  currentStage?: ProcessingStage;
  stages: StageStatus[];
  error?: string;
  finalVideoUrl?: string;
  metadata?: VideoMetadata;
}

export type ProcessingStage = 
  | 'prompts' 
  | 'images' 
  | 'videos' 
  | 'audio' 
  | 'merge';

export interface StageStatus {
  stage: ProcessingStage;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  progress?: number;
  startTime?: string;
  endTime?: string;
  error?: string;
}

export interface VideoMetadata {
  filename: string;
  duration: number;
  resolution: string;
  fileSize: number;
  sceneCount: number;
  hasVoiceover: boolean;
  hasMusic: boolean;
  createdAt: string;
}

export interface SceneData {
  sceneNumber: number;
  prompt: string;
  imageUrl: string;
  videoUrl: string;
}

export interface SessionProgress {
  sessionId: string;
  stages: StageStatus[];
  currentStage?: ProcessingStage;
  overallProgress: number;
  startTime: string;
  estimatedTimeRemaining?: number;
}
