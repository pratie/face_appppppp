import { GenerationRequest, GenerationSession } from '../types';
import { OpenAIService } from './openai';
import { ImageService } from './image';
import { KlingService } from './kling';
import { ElevenLabsService } from './elevenlabs';
import { FFmpegService } from './ffmpeg';
import { SessionManager } from './sessionManager';
import { config } from '../utils/config';
import { 
  AppError, 
  handleServiceError, 
  shouldRetry, 
  getRetryDelay, 
  attemptRecovery,
  createErrorSummary,
  logError
} from '../utils/errorHandler';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs-extra';

export class VideoGeneratorService {
  private openaiService: OpenAIService;
  private imageService: ImageService;
  private klingService: KlingService;
  private elevenLabsService: ElevenLabsService;
  private ffmpegService: FFmpegService;
  private sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.openaiService = new OpenAIService();
    this.imageService = new ImageService();
    this.klingService = new KlingService();
    this.elevenLabsService = new ElevenLabsService();
    this.ffmpegService = new FFmpegService();
    this.sessionManager = sessionManager;
  }

  async generateVideo(
    request: GenerationRequest,
    characterImagePath: string
  ): Promise<string> {
    // Create session
    const session = this.sessionManager.createSession(request, characterImagePath);
    const { sessionId } = session;

    logger.info('Starting video generation', {
      sessionId,
      sceneCount: request.sceneCount,
      description: request.description.substring(0, 100) + '...'
    });

    try {
      // Ensure session directories exist
      await this.sessionManager.ensureSessionDirectories(sessionId);

      // Update session to processing
      this.sessionManager.updateSessionStatus(sessionId, 'processing');

      // Execute generation pipeline with error handling
      await this.executeGenerationPipeline(session);

      this.sessionManager.updateSessionStatus(sessionId, 'completed');
      logger.info('Video generation completed (All Milestones)', { sessionId });

      return sessionId;

    } catch (error) {
      const appError = error instanceof AppError ? error : handleServiceError(error, { sessionId });
      const errorSummary = createErrorSummary(appError);
      
      logError(appError, { sessionId, stage: 'generation' });

      // Update session with detailed error information
      this.sessionManager.updateSessionStatus(
        sessionId,
        'failed',
        errorSummary.message,
        errorSummary
      );

      // Attempt recovery if possible
      const recovered = await attemptRecovery(appError, { sessionId, stage: 'generation' });
      if (recovered) {
        logger.info('Error recovery successful, retrying generation', { sessionId });
        return this.generateVideo(request, characterImagePath);
      }

      throw appError;
    }
  }

  private async executeGenerationPipeline(session: GenerationSession): Promise<void> {
    const { request } = session;

    // Step 1: Generate prompts with OpenAI
    await this.executeWithRetry(() => this.generatePrompts(session), 'prompts', session.sessionId);

    // Step 2: Generate scene images with Ideogram
    await this.executeWithRetry(() => this.generateImages(session), 'images', session.sessionId);

    // Step 3: Generate videos with Kling (Milestone 2)
    await this.executeWithRetry(() => this.generateVideos(session), 'videos', session.sessionId);

    // Step 4: Generate audio if requested (Milestone 3)
    if (request.includeVoiceover || request.includeMusic) {
      await this.executeWithRetry(() => this.generateAudio(session), 'audio', session.sessionId);
    }

    // Step 5: Merge videos and audio (Milestone 2-3)
    await this.executeWithRetry(() => this.mergeVideoContent(session), 'merge', session.sessionId);
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    stage: string,
    sessionId: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: AppError | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const appError = error instanceof AppError ? error : handleServiceError(error, {
          sessionId,
          stage,
          attempt
        });

        lastError = appError;
        logError(appError, { sessionId, stage, attempt });

        // Check if we should retry
        if (!shouldRetry(appError, attempt, maxRetries)) {
          throw appError;
        }

        // Wait before retrying
        const delay = getRetryDelay(attempt);
        logger.info(`Retrying ${stage} after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
          sessionId,
          stage,
          attempt: attempt + 1,
          delay
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  private async generatePrompts(session: GenerationSession): Promise<void> {
    const { sessionId, request } = session;
    
    logger.info('Generating prompts', { sessionId, stage: 'prompts' });
    this.sessionManager.updateStageStatus(sessionId, 'prompts', 'processing', 'Generating scene prompts...');

    try {
      const prompts = await this.openaiService.generatePrompts(
        request.sceneCount,
        request.description,
        false, // Disable voiceover prompts for now
        request.includeMusic,
        sessionId
      );

      // Save prompts to session artifacts
      await this.sessionManager.saveSessionArtifacts(sessionId, { prompts });

      this.sessionManager.updateStageStatus(
        sessionId,
        'prompts',
        'completed',
        `Generated prompts for ${prompts.scenePrompts.length} scenes`
      );

      logger.info('Prompts generated successfully', {
        sessionId,
        sceneCount: prompts.scenePrompts.length
      });

    } catch (error) {
      this.sessionManager.updateStageStatus(
        sessionId,
        'prompts',
        'error',
        'Failed to generate prompts',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async generateImages(session: GenerationSession): Promise<void> {
    const { sessionId } = session;
    
    logger.info('Generating images', { sessionId, stage: 'images' });
    this.sessionManager.updateStageStatus(sessionId, 'images', 'processing', 'Generating scene images...');

    try {
      // Read prompts from artifacts
      const artifactsPath = path.join(process.cwd(), 'runs', sessionId, 'artifacts.json');
      const artifacts = await fs.readJson(artifactsPath);
      const { prompts } = artifacts;

      if (!prompts?.scenePrompts) {
        throw new Error('No scene prompts found in artifacts');
      }

      // Generate images with rolling reference using selected provider
      const imagePaths = await this.imageService.generateSceneImages(
        prompts.scenePrompts,
        session.characterImagePath,
        sessionId,
        session.request.imageOptions || { provider: 'nano-banana', outputFormat: 'png', includeOriginalAnchor: true }
      );

      // Update artifacts with image paths
      await this.sessionManager.saveSessionArtifacts(sessionId, {
        ...artifacts,
        imagePaths
      });

      this.sessionManager.updateStageStatus(
        sessionId,
        'images',
        'completed',
        `Generated ${imagePaths.length} scene images with character consistency`
      );

      logger.info('Images generated successfully', {
        sessionId,
        imageCount: imagePaths.length
      });

    } catch (error) {
      this.sessionManager.updateStageStatus(
        sessionId,
        'images',
        'error',
        'Failed to generate images',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<GenerationSession | undefined> {
    return this.sessionManager.getSession(sessionId);
  }

  async getSessionProgress(sessionId: string) {
    return this.sessionManager.getSessionProgress(sessionId);
  }

  private async generateVideos(session: GenerationSession): Promise<void> {
    const { sessionId, request } = session;
    
    logger.info('Generating videos', { sessionId, stage: 'videos' });
    this.sessionManager.updateStageStatus(sessionId, 'videos', 'processing', 'Generating scene videos...');

    try {
      // Read artifacts to get prompts and image paths
      const artifactsPath = path.join(config.runsDir, sessionId, 'artifacts.json');
      const artifacts = await fs.readJson(artifactsPath);
      const { prompts, imagePaths } = artifacts;

      if (!prompts?.scenePrompts || !imagePaths) {
        throw new Error('Missing prompts or image paths in artifacts');
      }

      // Generate videos for each scene
      const videoPaths = await this.klingService.generateSceneVideos(
        prompts.scenePrompts.map((scene: any) => ({
          prompt: scene.prompt,
          videoPrompt: scene.videoPrompt || scene.prompt
        })),
        imagePaths,
        sessionId,
        {
          sceneDurationSeconds: config.sceneDurationSeconds,
          aspectRatio: '16:9',
          cameraMovement: 'none'
        }
      );

      // Update artifacts with video paths
      await this.sessionManager.saveSessionArtifacts(sessionId, {
        ...artifacts,
        videoPaths
      });

      this.sessionManager.updateStageStatus(
        sessionId,
        'videos',
        'completed',
        `Generated ${videoPaths.length} scene videos`
      );

      logger.info('Videos generated successfully', {
        sessionId,
        videoCount: videoPaths.length
      });

    } catch (error) {
      this.sessionManager.updateStageStatus(
        sessionId,
        'videos',
        'error',
        'Failed to generate videos',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async generateAudio(session: GenerationSession): Promise<void> {
    const { sessionId, request } = session;
    
    logger.info('Generating audio', { sessionId, stage: 'audio' });
    this.sessionManager.updateStageStatus(sessionId, 'audio', 'processing', 'Generating audio content...');

    try {
      // Read artifacts to get prompts
      const artifactsPath = path.join(config.runsDir, sessionId, 'artifacts.json');
      const artifacts = await fs.readJson(artifactsPath);
      const { prompts } = artifacts;

      if (!prompts) {
        throw new Error('No prompts found in artifacts');
      }

      const audioPaths: any = {};

      // Generate background music if requested
      if (request.includeMusic && prompts.musicPrompt) {
        logger.info('Generating background music', { sessionId });
        const totalDuration = request.sceneCount * config.sceneDurationSeconds;
        const musicPath = await this.elevenLabsService.generateBackgroundMusic(
          prompts.musicPrompt,
          totalDuration,
          sessionId
        );
        audioPaths.musicPath = musicPath;
      }

      // Update artifacts with audio paths
      await this.sessionManager.saveSessionArtifacts(sessionId, {
        ...artifacts,
        audioPaths
      });

      this.sessionManager.updateStageStatus(
        sessionId,
        'audio',
        'completed',
        'Audio generation completed'
      );

      logger.info('Audio generated successfully', { sessionId });

    } catch (error) {
      this.sessionManager.updateStageStatus(
        sessionId,
        'audio',
        'error',
        'Failed to generate audio',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async mergeVideoContent(session: GenerationSession): Promise<void> {
    const { sessionId, request } = session;
    
    logger.info('Merging video content', { sessionId, stage: 'merge' });
    this.sessionManager.updateStageStatus(sessionId, 'merge', 'processing', 'Merging videos and audio...');

    try {
      // Read artifacts to get video and audio paths
      const artifactsPath = path.join(config.runsDir, sessionId, 'artifacts.json');
      const artifacts = await fs.readJson(artifactsPath);
      const { videoPaths, audioPaths } = artifacts;

      if (!videoPaths || videoPaths.length === 0) {
        throw new Error('No video paths found for merging');
      }

      const sessionDir = path.join(config.runsDir, sessionId);
      const finalVideoPath = path.join(sessionDir, 'final_video.mp4');

      // Step 1: Concatenate videos
      logger.info('Concatenating scene videos', { sessionId });
      const mergedVideoPath = path.join(sessionDir, 'merged_scenes.mp4');
      
      await this.ffmpegService.concatenateVideos({
        videoPaths,
        outputPath: mergedVideoPath,
        fadeTransition: false,
        // If you want transitions later, compute accurate offsets with real durations
      });

      // Step 2: Add audio if available
      if (audioPaths && (audioPaths.voiceoverPaths || audioPaths.musicPath)) {
        logger.info('Adding audio to merged video', { sessionId });
        
        // First, merge voiceovers if available
        let audioMixPath = mergedVideoPath;
        
        if (audioPaths.musicPath) {
          audioMixPath = await this.ffmpegService.addAudioToVideo(mergedVideoPath, {
            musicPath: audioPaths.musicPath,
            outputPath: finalVideoPath,
            musicVolume: 0.5
          });
        }
      } else {
        // No audio, just copy the merged video as final
        await fs.copy(mergedVideoPath, finalVideoPath);
      }

      // Update session with final video path
      this.sessionManager.updateSessionFinalVideo(sessionId, finalVideoPath);

      // Update artifacts with final video path
      await this.sessionManager.saveSessionArtifacts(sessionId, {
        ...artifacts,
        finalVideoPath
      });

      this.sessionManager.updateStageStatus(
        sessionId,
        'merge',
        'completed',
        'Video merging completed successfully'
      );

      logger.info('Video content merged successfully', { 
        sessionId, 
        finalVideoPath 
      });

    } catch (error) {
      this.sessionManager.updateStageStatus(
        sessionId,
        'merge',
        'error',
        'Failed to merge video content',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  // Test all service connections
  async testServices(): Promise<{ 
    openai: boolean; 
    ideogram: boolean; 
    kling: boolean; 
    elevenlabs: boolean;
    ffmpeg: boolean;
  }> {
    const [openai, elevenlabs] = await Promise.allSettled([
      this.openaiService.testConnection(),
      this.elevenLabsService.getAvailableVoices().then(() => true).catch(() => false)
    ]);

    // Test FFmpeg availability
    let ffmpeg = false;
    try {
      await this.ffmpegService.getVideoInfo(__filename); // Test with any file
      ffmpeg = false; // Will fail since __filename is not a video, but FFmpeg is available
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      ffmpeg = msg.includes('ffprobe') ? false : true;
    }

    // Test Kling (Replicate) - we'll assume it's working if we have a token
    const kling = !!config.falApiKey;
    // For image generation, we consider availability if Replicate token is present
    const ideogram = !!config.replicateApiToken;

    return {
      openai: openai.status === 'fulfilled' ? openai.value : false,
      ideogram,
      kling,
      elevenlabs: elevenlabs.status === 'fulfilled' ? elevenlabs.value : false,
      ffmpeg
    };
  }
}
