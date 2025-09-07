import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { withRetry, REPLICATE_RETRY_OPTIONS } from '../utils/retry';
import { ScenePrompts } from '../types';

export type ImageProvider = 'ideogram' | 'nano-banana';

export interface ImageGenerationOptions {
  provider: ImageProvider;
  outputFormat?: 'png' | 'jpg';
  includeOriginalAnchor?: boolean; // when true (nano-banana), also include the original uploaded character image as a 2nd reference
}

export class ImageService {
  private client: Replicate;

  constructor() {
    this.client = new Replicate({ auth: config.replicateApiToken });
  }

  async generateSceneImages(
    scenePrompts: ScenePrompts[],
    originalCharacterImagePath: string,
    sessionId: string,
    options: ImageGenerationOptions
  ): Promise<string[]> {
    logger.info('Starting scene image generation', {
      sessionId,
      sceneCount: scenePrompts.length,
      originalCharacterImagePath,
      provider: options.provider
    });

    const imagePaths: string[] = [];
    let previousImagePath = originalCharacterImagePath; // Start with the uploaded/captured character image

    for (let i = 0; i < scenePrompts.length; i++) {
      const scene = scenePrompts[i];
      const sceneImagePath = await this.generateSingleSceneImage(
        scene,
        previousImagePath,
        originalCharacterImagePath,
        sessionId,
        i + 1,
        options
      );

      imagePaths.push(sceneImagePath);
      previousImagePath = sceneImagePath; // rolling reference
    }

    logger.info('Completed all scene image generation', {
      sessionId,
      generatedImages: imagePaths.length
    });

    return imagePaths;
  }

  private async generateSingleSceneImage(
    scenePrompt: ScenePrompts,
    referenceImagePath: string,
    originalCharacterImagePath: string,
    sessionId: string,
    sceneNumber: number,
    options: ImageGenerationOptions
  ): Promise<string> {
    const outputPath = path.join(config.imagesDir, sessionId, `scene-${sceneNumber}.png`);
    await fs.ensureDir(path.dirname(outputPath));

    try {
      const result = await withRetry(
        async () => {
          const referenceImageBuffer = await fs.readFile(referenceImagePath);
          const originalAnchorBuffer = options.includeOriginalAnchor
            ? await fs.readFile(originalCharacterImagePath)
            : undefined;

          let model: `${string}/${string}`;
          let input: any = {};

          if (options.provider === 'nano-banana') {
            model = 'google/nano-banana';
            const image_input = originalAnchorBuffer
              ? [referenceImageBuffer, originalAnchorBuffer]
              : [referenceImageBuffer];

            input = {
              prompt: scenePrompt.imagePrompt,
              image_input,
              output_format: options.outputFormat || 'png'
            };

            logger.debug('Calling Nano Banana API', {
              sessionId,
              sceneNumber,
              prompt: scenePrompt.imagePrompt.substring(0, 100) + '...'
            });
          } else {
            // ideogram
            model = 'ideogram-ai/ideogram-character';
            input = {
              prompt: scenePrompt.imagePrompt,
              character_reference_image: referenceImageBuffer,
              aspect_ratio: '16:9',
              style_type: 'Auto',
              rendering_speed: 'Default',
              magic_prompt_option: 'Auto'
            };

            logger.debug('Calling Ideogram API', {
              sessionId,
              sceneNumber,
              prompt: scenePrompt.imagePrompt.substring(0, 100) + '...'
            });
          }

          const output = (await this.client.run(model, { input })) as any;

          logger.debug('Image model API output', {
            sessionId,
            sceneNumber,
            provider: options.provider,
            outputType: typeof output,
            outputStructure: Array.isArray(output) ? 'array' : typeof output,
            outputKeys: output && typeof output === 'object' ? Object.keys(output) : 'N/A'
          });

          if (!output) {
            throw new Error('Invalid output from image model API - no output received');
          }

          // Handle different output formats from Replicate
          let imageUrl: string;
          if (typeof output === 'string') {
            imageUrl = output;
          } else if (Array.isArray(output) && output.length > 0) {
            imageUrl = output[0];
          } else if (output.url) {
            imageUrl = typeof output.url === 'function' ? output.url() : output.url;
          } else {
            logger.error('Unexpected image model output format:', {
              sessionId,
              output: JSON.stringify(output, null, 2)
            });
            throw new Error('Unable to extract URL from image model API output');
          }

          return { imageUrl };
        },
        REPLICATE_RETRY_OPTIONS,
        {
          sessionId,
          stage: 'images',
          operation: `scene-${sceneNumber}-${options.provider}`
        }
      );

      // Download the generated image
      logger.info('Downloading generated image', {
        sessionId,
        sceneNumber,
        outputPath
      });

      const imageUrl = result.imageUrl;
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(outputPath, Buffer.from(buffer));

      logger.info('Successfully generated and saved scene image', {
        sessionId,
        sceneNumber,
        outputPath,
        fileSizeBytes: buffer.byteLength
      });

      return outputPath;
    } catch (error) {
      logger.error('Failed to generate scene image', {
        sessionId,
        sceneNumber,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
