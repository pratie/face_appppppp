import Replicate from 'replicate';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { withRetry, REPLICATE_RETRY_OPTIONS } from '../utils/retry';
import { ScenePrompts } from '../types';

export class IdeogramService {
  private client: Replicate;

  constructor() {
    this.client = new Replicate({
      auth: config.replicateApiToken
    });
  }

  async generateSceneImages(
    scenePrompts: ScenePrompts[],
    characterImagePath: string,
    sessionId: string
  ): Promise<string[]> {
    logger.info('Starting scene image generation', {
      sessionId,
      sceneCount: scenePrompts.length,
      characterImagePath
    });

    const imagePaths: string[] = [];
    let previousImagePath = characterImagePath; // Start with the uploaded/captured character image

    for (let i = 0; i < scenePrompts.length; i++) {
      const scene = scenePrompts[i];
      const sceneImagePath = await this.generateSingleSceneImage(
        scene,
        previousImagePath,
        sessionId,
        i + 1
      );
      
      imagePaths.push(sceneImagePath);
      
      // Use this scene's image as the reference for the next scene (rolling reference)
      previousImagePath = sceneImagePath;
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
    sessionId: string,
    sceneNumber: number
  ): Promise<string> {
    logger.info('Generating image for scene', {
      sessionId,
      sceneNumber,
      referenceImagePath
    });

    const outputPath = path.join(
      config.imagesDir,
      sessionId,
      `scene-${sceneNumber}.png`
    );

    // Ensure output directory exists
    await fs.ensureDir(path.dirname(outputPath));

    try {
      const result = await withRetry(
        async () => {
          // Read the reference image as a Buffer
          const referenceImageBuffer = await fs.readFile(referenceImagePath);

          const input = {
            prompt: scenePrompt.imagePrompt,
            // google/nano-banana expects an array of images for reference/editing
            image_input: [referenceImageBuffer],
            output_format: "png"
          };

          logger.debug('Calling Nano Banana API', {
            sessionId,
            sceneNumber,
            prompt: scenePrompt.imagePrompt.substring(0, 100) + '...'
          });

          const output = await this.client.run(
            "google/nano-banana",
            { input }
          ) as any;

          // Debug: Log the actual output structure
          logger.debug('Nano Banana API output:', {
            sessionId,
            sceneNumber,
            outputType: typeof output,
            outputStructure: Array.isArray(output) ? 'array' : typeof output,
            outputKeys: output && typeof output === 'object' ? Object.keys(output) : 'N/A'
          });

          if (!output) {
            throw new Error('Invalid output from Nano Banana API - no output received');
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
            logger.error('Unexpected Nano Banana output format:', {
              sessionId,
              output: JSON.stringify(output, null, 2)
            });
            throw new Error('Unable to extract URL from Nano Banana API output');
          }

          return { imageUrl };
        },
        REPLICATE_RETRY_OPTIONS,
        {
          sessionId,
          stage: 'images',
          operation: `scene-${sceneNumber}-nano-banana`
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

  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple image generation
      const testImageBuffer = Buffer.alloc(1024); // Minimal test buffer
      
      const input = {
        prompt: "a simple test image of a person",
        image_input: [testImageBuffer],
        output_format: "png"
      };

      // We'll just try to create the prediction without waiting for completion
      const prediction = await this.client.predictions.create({
        model: "google/nano-banana",
        input
      });

      return prediction.id !== undefined;
      
    } catch (error) {
      logger.error('Nano Banana connection test failed', { error });
      return false;
    }
  }
}