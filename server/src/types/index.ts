export interface GenerationRequest {
  sceneCount: number;
  description: string;
  includeVoiceover: boolean;
  includeMusic: boolean;
  imageOptions?: ImageGenerationOptions;
}

export interface GenerationSession {
  sessionId: string;
  request: GenerationRequest;
  characterImagePath: string;
  status: SessionStatus;
  stages: StageStatus[];
  currentStage?: ProcessingStage;
  createdAt: string;
  updatedAt: string;
  error?: string;
  finalVideoPath?: string;
  metadata?: VideoMetadata;
}

export type SessionStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
  retryCount?: number;
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

export interface ScenePrompts {
  sceneNumber: number;
  imagePrompt: string;
  videoPrompt: string;
}

export interface GeneratedPrompts {
  scenePrompts: ScenePrompts[];
  voiceoverScript?: string;
  musicPrompt?: string;
}

export type ImageProvider = 'ideogram' | 'nano-banana';

export interface ImageGenerationOptions {
  provider: ImageProvider; // which model provider to use
  outputFormat?: 'png' | 'jpg'; // default png
  includeOriginalAnchor?: boolean; // include original uploaded image along with rolling reference
}

export interface SceneAssets {
  sceneNumber: number;
  imagePath: string;
  videoPath: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface RetryableError extends Error {
  retryable: boolean;
  retryAfter?: number;
}