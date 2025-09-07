import OpenAI from 'openai';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { GeneratedPrompts } from '../types';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openaiApiKey
    });
  }

  async generatePrompts(
    sceneCount: number,
    description: string,
    includeVoiceover: boolean,
    includeMusic: boolean,
    sessionId: string
  ): Promise<GeneratedPrompts> {
    logger.info('Generating prompts with OpenAI', { 
      sessionId, 
      sceneCount, 
      includeVoiceover, 
      includeMusic 
    });

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { 
          type: "json_schema",
          json_schema: {
            name: "video_prompts",
            schema: {
              type: "object",
              properties: {
                scenePrompts: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sceneNumber: { type: "number" },
                      imagePrompt: { type: "string" },
                      videoPrompt: { type: "string" }
                    },
                    required: ["sceneNumber", "imagePrompt", "videoPrompt"],
                    additionalProperties: false
                  }
                },
                ...(includeVoiceover && { voiceoverScript: { type: "string" } }),
                ...(includeMusic && { musicPrompt: { type: "string" } })
              },
              required: ["scenePrompts", ...(includeVoiceover ? ["voiceoverScript"] : []), ...(includeMusic ? ["musicPrompt"] : [])],
              additionalProperties: false
            },
            strict: true
          }
        },
        messages: [
          {
            role: "system",
            content: `You are an expert at creating visual and cinematic prompts for AI video generation. 
            You will help create character-consistent multi-scene videos based on a user's description.
            
            Rules:
            1. Create ${sceneCount} scenes that flow together narratively
            2. Each scene should maintain character consistency
            3. Image prompts should describe detailed visual scenes tailored for the selected image model on Replicate (Ideogram Character or Google Nano Banana), including any reference details needed for consistent character portrayal
            4. Video prompts should describe motion and action for Kling v2.1 model
            5. Keep prompts clear, detailed but concise
            6. Ensure scenes connect logically and tell a cohesive story
            7. Each scene should be 5 seconds of action
            
            Always respond with valid JSON only.`
          },
          {
            role: "user", 
            content: `Create a ${sceneCount}-scene video based on this description: "${description}"
            
            ${includeVoiceover ? 'Also generate a voiceover script that narrates the scenes.' : ''}
            ${includeMusic ? 'Also generate a prompt for background music that fits the mood and tone.' : ''}
            
            Return the response as JSON with this exact structure:
            {
              "scenePrompts": [
                {
                  "sceneNumber": 1,
                  "imagePrompt": "Detailed visual description for image generation",
                  "videoPrompt": "Motion and action description for video generation"
                }
              ]${includeVoiceover ? ',\n  "voiceoverScript": "Complete narration script for all scenes"' : ''}${includeMusic ? ',\n  "musicPrompt": "Music style and mood description"' : ''}
            }`
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      let prompts: GeneratedPrompts;
      try {
        // Since we used response_format: "json_object", the content should be valid JSON
        logger.debug('Parsing JSON response from OpenAI', { sessionId, contentLength: content.length, contentPreview: content.substring(0, 200) });
        
        prompts = JSON.parse(content) as GeneratedPrompts;
      } catch (parseError) {
        logger.error('Failed to parse JSON from OpenAI response', { 
          sessionId, 
          parseError: parseError instanceof Error ? parseError.message : String(parseError),
          content: content.substring(0, 500)
        });
        throw new Error(`Invalid JSON in OpenAI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Validate the response structure
      if (!prompts.scenePrompts || !Array.isArray(prompts.scenePrompts)) {
        throw new Error('Invalid response structure: missing scenePrompts array');
      }

      if (prompts.scenePrompts.length !== sceneCount) {
        throw new Error(`Expected ${sceneCount} scenes, got ${prompts.scenePrompts.length}`);
      }

      // Validate each scene prompt
      for (const scene of prompts.scenePrompts) {
        if (!scene.imagePrompt || !scene.videoPrompt || typeof scene.sceneNumber !== 'number') {
          throw new Error(`Invalid scene prompt structure for scene ${scene.sceneNumber}`);
        }
      }

      if (includeVoiceover && !prompts.voiceoverScript) {
        throw new Error('Voiceover requested but not provided in response');
      }

      if (includeMusic && !prompts.musicPrompt) {
        throw new Error('Music requested but not provided in response');
      }

      logger.info('Successfully generated prompts', { 
        sessionId, 
        sceneCount: prompts.scenePrompts.length,
        hasVoiceover: !!prompts.voiceoverScript,
        hasMusic: !!prompts.musicPrompt
      });

      return prompts;

    } catch (error) {
      logger.error('Failed to generate prompts', { sessionId, error });
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: "Test message - please respond with 'OK'"
          }
        ],
        max_tokens: 10
      });
      
      return response.choices[0]?.message?.content?.includes('OK') || false;
    } catch (error) {
      logger.error('OpenAI connection test failed', { error });
      return false;
    }
  }
}