import { fal } from '@fal-ai/client';
import { config } from '../utils/config';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';

interface KlingVideoOptions {
  imageUrl: string;
  prompt: string;
  duration: number; // seconds (5 or 10)
  aspectRatio: '16:9' | '9:16' | '1:1';
  cameraMovement: 'horizontal' | 'vertical' | 'pan' | 'tilt' | 'roll' | 'zoom' | 'none';
}

interface KlingVideoResult {
  videoUrl: string;
  duration: number;
  status: 'completed' | 'failed';
}

export class KlingService {
  constructor() {
    // Configure Fal.ai client
    fal.config({
      credentials: config.falApiKey,
    });
  }

  async generateVideo(options: KlingVideoOptions): Promise<KlingVideoResult> {
    logger.info('Starting Kling video generation with Fal.ai', { 
      prompt: options.prompt,
      duration: options.duration,
      aspectRatio: options.aspectRatio 
    });

    return withRetry(async () => {
      try {
        const input = {
          image_url: options.imageUrl, // Fal.ai uses image_url instead of start_image
          prompt: options.prompt,
          duration: (options.duration === 5 ? "5" : "10") as "5" | "10", // Fal.ai expects specific string values
          negative_prompt: "blur, distort, and low quality",
          cfg_scale: 0.5
        };

        logger.info('Submitting to Fal.ai Kling v2.1', { 
          prompt: input.prompt,
          duration: input.duration,
          imageUrlLength: input.image_url.length
        });

        const startTime = Date.now();

        // Use fal.subscribe for automatic handling of queue and progress
        const result = await fal.subscribe("fal-ai/kling-video/v2.1/standard/image-to-video", {
          input,
          logs: true,
          onQueueUpdate: (update) => {
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            
            logger.info('Fal.ai Kling generation progress', { 
              status: update.status,
              elapsedSeconds,
              requestId: update.request_id
            });

            if (update.status === "IN_PROGRESS" && update.logs) {
              const latestLogs = update.logs.slice(-3); // Get last 3 log entries
              logger.info('Fal.ai generation logs', { 
                logs: latestLogs.map(log => log.message).join('; ')
              });
            }
          },
        });

        const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        
        logger.info('Fal.ai Kling generation completed', { 
          requestId: result.requestId,
          elapsedTime,
          hasVideoData: !!result.data?.video
        });

        // Extract video URL from Fal.ai response
        if (!result.data?.video?.url) {
          logger.error('No video URL in Fal.ai response', { 
            resultData: JSON.stringify(result.data, null, 2),
            requestId: result.requestId
          });
          throw new Error('No video URL returned from Fal.ai Kling API');
        }

        const videoUrl = result.data.video.url;
        logger.info('Video URL extracted successfully', { 
          videoUrl,
          requestId: result.requestId
        });

        return {
          videoUrl,
          duration: options.duration,
          status: 'completed' as const
        };

      } catch (error) {
        // Log richer error details for troubleshooting (e.g., 403 Forbidden)
        try {
          const details = typeof error === 'object' ? JSON.stringify(error) : String(error);
          logger.error('Fal.ai Kling video generation failed', { error: details });
        } catch (_) {
          logger.error('Fal.ai Kling video generation failed', { 
            error: error instanceof Error ? error.message : String(error)
          });
        }
        throw error;
      }
    }, {
      maxAttempts: 3,  // Reduce retries since Fal.ai is more reliable
      baseDelayMs: 3000,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5
    });
  }

  async generateSceneVideos(
    scenePrompts: Array<{prompt: string, videoPrompt: string}>,
    sceneImagePaths: string[],
    sessionId: string,
    videoConfig: {
      sceneDurationSeconds: number;
      aspectRatio: '16:9' | '9:16' | '1:1';
      cameraMovement: 'horizontal' | 'vertical' | 'pan' | 'tilt' | 'roll' | 'zoom' | 'none';
    }
  ): Promise<string[]> {
    logger.info('Starting batch video generation', { 
      sceneCount: scenePrompts.length,
      sessionId 
    });

    const videoUrls: string[] = [];
    const sessionDir = path.join(config.runsDir, sessionId);
    const videosDir = path.join(sessionDir, 'videos');
    await fs.ensureDir(videosDir);

    for (let i = 0; i < scenePrompts.length; i++) {
      const scene = scenePrompts[i];
      const imagePath = sceneImagePaths[i];

      logger.info(`Generating video for scene ${i + 1}/${scenePrompts.length}`, {
        sessionId,
        scene: i + 1
      });

      try {
        // Read image file and convert to base64 data URL for Fal.ai
        const imageBuffer = await fs.readFile(imagePath);
        const ext = path.extname(imagePath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
        const imageBase64 = `data:${mime};base64,${imageBuffer.toString('base64')}`;

        const videoResult = await this.generateVideo({
          imageUrl: imageBase64,
          prompt: scene.videoPrompt,
          duration: videoConfig.sceneDurationSeconds,
          aspectRatio: videoConfig.aspectRatio,
          cameraMovement: videoConfig.cameraMovement
        });

        // Download the video from the URL
        const videoPath = path.join(videosDir, `scene_${i + 1}.mp4`);
        await this.downloadVideo(videoResult.videoUrl, videoPath);
        
        videoUrls.push(videoPath);
        logger.info(`Scene ${i + 1} video saved`, { videoPath });

      } catch (error) {
        logger.error(`Failed to generate video for scene ${i + 1}`, { 
          error: error instanceof Error ? error.message : String(error),
          sessionId 
        });
        throw new Error(`Scene ${i + 1} video generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logger.info('Batch video generation completed', { 
      sessionId,
      videoCount: videoUrls.length 
    });

    return videoUrls;
  }

  private async downloadVideo(videoUrl: string, outputPath: string): Promise<void> {
    logger.info('Downloading video', { videoUrl, outputPath });

    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
    
    logger.info('Video downloaded successfully', { outputPath });
  }

  async getOptimalCameraMovement(scenePrompt: string): Promise<string> {
    // Simple heuristic to determine camera movement based on scene content
    const prompt = scenePrompt.toLowerCase();
    
    if (prompt.includes('walk') || prompt.includes('move') || prompt.includes('travel')) {
      return 'horizontal';
    } else if (prompt.includes('look up') || prompt.includes('sky') || prompt.includes('tall')) {
      return 'vertical';
    } else if (prompt.includes('panoram') || prompt.includes('landscape') || prompt.includes('wide')) {
      return 'pan';
    } else if (prompt.includes('close') || prompt.includes('detail') || prompt.includes('zoom')) {
      return 'zoom';
    } else {
      return 'none'; // Static shot for dialogue or simple scenes
    }
  }
}