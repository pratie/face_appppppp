import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from '../utils/config';
import { withRetry } from '../utils/retry';
import logger from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';

interface VoiceOptions {
  voice: string;
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

interface MusicOptions {
  prompt: string;
  duration: number; // seconds
  mode: 'auto' | 'custom';
  tags?: string;
}

export class ElevenLabsService {
  private client: ElevenLabsClient;
  private voices: any[] = [];

  constructor() {
    this.client = new ElevenLabsClient({
      apiKey: config.elevenlabsApiKey,
    });
    this.initializeVoices();
  }

  private async initializeVoices(): Promise<void> {
    try {
      const response = await this.client.voices.getAll();
      this.voices = response.voices || [];
      logger.info(`Loaded ${this.voices.length} ElevenLabs voices`);
    } catch (error) {
      logger.error('Failed to load ElevenLabs voices', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  async generateSpeech(
    text: string,
    outputPath: string,
    options: Partial<VoiceOptions> = {}
  ): Promise<string> {
    logger.info('Starting TTS generation', { 
      textLength: text.length,
      outputPath,
      voice: options.voice 
    });

    return withRetry(async () => {
      try {
        // Default voice options
        const voiceOptions: VoiceOptions = {
          voice: options.voice || 'Hjzqw9NR0xFMYU9Us0DL', // Default to specified voice ID
          model: options.model || 'eleven_turbo_v2_5',
          stability: options.stability ?? 0.5,
          similarityBoost: options.similarityBoost ?? 0.75,
          style: options.style ?? 0.0,
          useSpeakerBoost: options.useSpeakerBoost ?? true,
        };

        // Find voice ID
        let voiceId = voiceOptions.voice;
        const foundVoice = this.voices.find(v => 
          v.name.toLowerCase() === voiceOptions.voice.toLowerCase()
        );
        if (foundVoice) {
          voiceId = foundVoice.voice_id;
        }

        logger.info('Generating speech with ElevenLabs', { 
          voiceId,
          model: voiceOptions.model 
        });

        const audioStream = await this.client.textToSpeech.convert(voiceId, {
          text,
          modelId: voiceOptions.model, // Fixed: modelId instead of model_id
          voiceSettings: {
            stability: voiceOptions.stability,
            similarityBoost: voiceOptions.similarityBoost, // Fixed: camelCase
            style: voiceOptions.style,
            useSpeakerBoost: voiceOptions.useSpeakerBoost, // Fixed: camelCase
          },
        });

        // Ensure output directory exists
        await fs.ensureDir(path.dirname(outputPath));

        // Save audio stream to file
        await this.saveAudioStream(audioStream, outputPath);

        logger.info('TTS generation completed', { outputPath });
        return outputPath;

      } catch (error) {
        logger.error('TTS generation failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      backoffMultiplier: 2
    });
  }

  async generateMusic(
    options: MusicOptions,
    outputPath: string
  ): Promise<string> {
    logger.info('Starting music generation', { 
      prompt: options.prompt,
      duration: options.duration,
      outputPath 
    });

    return withRetry(async () => {
      try {
        logger.info('Generating music with ElevenLabs', { 
          prompt: options.prompt,
          duration: options.duration 
        });

        // Generate music using ElevenLabs Music API
        const musicTrack = await this.client.music.compose({
          prompt: options.prompt,
          musicLengthMs: options.duration * 1000, // Convert seconds to milliseconds
        });

        if (!musicTrack) {
          throw new Error('No audio data returned from music generation');
        }

        // Convert the audio stream to buffer
        let audioBuffer: Buffer;
        if (musicTrack instanceof Buffer) {
          audioBuffer = musicTrack;
        } else if (musicTrack instanceof ArrayBuffer) {
          audioBuffer = Buffer.from(musicTrack);
        } else {
          // Handle ReadableStream or other stream types
          const chunks: Uint8Array[] = [];
          const reader = (musicTrack as ReadableStream).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
        }
        await fs.ensureDir(path.dirname(outputPath));
        await fs.writeFile(outputPath, audioBuffer);

        logger.info('Music generation completed', { outputPath });
        return outputPath;

      } catch (error) {
        logger.error('Music generation failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
      }
    }, {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 10000,
      backoffMultiplier: 2
    });
  }

  async generateVoiceoverForScenes(
    voiceoverScripts: string[],
    sessionId: string,
    voiceOptions?: Partial<VoiceOptions>
  ): Promise<string[]> {
    logger.info('Starting batch voiceover generation', { 
      sceneCount: voiceoverScripts.length,
      sessionId 
    });

    const voiceoverPaths: string[] = [];
    const sessionDir = path.join(config.runsDir, sessionId);
    const audioDir = path.join(sessionDir, 'audio');
    await fs.ensureDir(audioDir);

    for (let i = 0; i < voiceoverScripts.length; i++) {
      const script = voiceoverScripts[i];
      
      if (!script.trim()) {
        logger.warn(`Empty script for scene ${i + 1}, skipping`);
        voiceoverPaths.push('');
        continue;
      }

      const outputPath = path.join(audioDir, `voiceover_${i + 1}.mp3`);

      try {
        await this.generateSpeech(script, outputPath, voiceOptions);
        voiceoverPaths.push(outputPath);
        
        logger.info(`Scene ${i + 1} voiceover generated`, { outputPath });

      } catch (error) {
        logger.error(`Failed to generate voiceover for scene ${i + 1}`, { 
          error: error instanceof Error ? error.message : String(error),
          sessionId 
        });
        throw new Error(`Scene ${i + 1} voiceover generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logger.info('Batch voiceover generation completed', { 
      sessionId,
      voiceoverCount: voiceoverPaths.filter(p => p).length 
    });

    return voiceoverPaths;
  }

  async generateBackgroundMusic(
    musicPrompt: string,
    duration: number,
    sessionId: string
  ): Promise<string> {
    logger.info('Generating background music', { 
      prompt: musicPrompt,
      duration,
      sessionId 
    });

    const sessionDir = path.join(config.runsDir, sessionId);
    const audioDir = path.join(sessionDir, 'audio');
    const outputPath = path.join(audioDir, 'background_music.mp3');

    await this.generateMusic({
      prompt: musicPrompt,
      duration,
      mode: 'auto'
    }, outputPath);

    logger.info('Background music generated', { outputPath });
    return outputPath;
  }

  private async saveAudioStream(audioStream: any, outputPath: string): Promise<void> {
    const chunks: Buffer[] = [];

    // Handle different stream types
    if (audioStream instanceof ReadableStream) {
      const reader = audioStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } else if (audioStream[Symbol.asyncIterator]) {
      // Handle async iterable
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
    } else if (Buffer.isBuffer(audioStream)) {
      chunks.push(audioStream);
    } else {
      throw new Error('Unsupported audio stream type');
    }

    const audioBuffer = Buffer.concat(chunks);
    await fs.writeFile(outputPath, audioBuffer);
  }

  async getAvailableVoices(): Promise<any[]> {
    if (this.voices.length === 0) {
      await this.initializeVoices();
    }
    return this.voices;
  }

  async getVoiceById(voiceId: string): Promise<any> {
    const voices = await this.getAvailableVoices();
    return voices.find(v => v.voice_id === voiceId);
  }

  async getVoiceByName(voiceName: string): Promise<any> {
    const voices = await this.getAvailableVoices();
    return voices.find(v => v.name.toLowerCase() === voiceName.toLowerCase());
  }

  // Helper method to suggest voice based on character description
  suggestVoice(characterDescription: string): string {
    const desc = characterDescription.toLowerCase();
    
    if (desc.includes('female') || desc.includes('woman') || desc.includes('girl')) {
      if (desc.includes('young')) return 'Rachel';
      if (desc.includes('mature') || desc.includes('professional')) return 'Dorothy';
      if (desc.includes('friendly') || desc.includes('warm')) return 'Freya';
      return 'Rachel'; // Default female voice
    } else if (desc.includes('male') || desc.includes('man') || desc.includes('boy')) {
      if (desc.includes('young')) return 'Adam';
      if (desc.includes('mature') || desc.includes('professional')) return 'Paul';
      if (desc.includes('deep') || desc.includes('strong')) return 'Antoni';
      return 'Adam'; // Default male voice
    }
    
    return 'Rachel'; // Default neutral voice
  }
}