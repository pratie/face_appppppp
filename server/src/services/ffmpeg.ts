import ffmpeg from 'fluent-ffmpeg';
import logger from '../utils/logger';
import fs from 'fs-extra';
import path from 'path';

export interface VideoMergeOptions {
  videoPaths: string[];
  outputPath: string;
  audioPath?: string;
  musicPath?: string;
  resolution?: string;
  fadeTransition?: boolean;
  transitionDuration?: number; // seconds
  sceneDuration?: number; // seconds per scene for crossfade timing
}

export interface AudioMixOptions {
  voiceoverPath?: string;
  musicPath?: string;
  outputPath: string;
  musicVolume?: number; // 0.0 to 1.0
  voiceVolume?: number; // 0.0 to 1.0
}

export class FFmpegService {
  constructor() {
    // Verify FFmpeg is available
    this.verifyFFmpeg();
  }

  private async verifyFFmpeg(): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          logger.error('FFmpeg not available', { error: err.message });
          reject(new Error('FFmpeg is not installed or not available in PATH'));
        } else {
          logger.info('FFmpeg is available');
          resolve();
        }
      });
    });
  }

  async concatenateVideos(options: VideoMergeOptions): Promise<string> {
    logger.info('Starting video concatenation', { 
      videoCount: options.videoPaths.length,
      outputPath: options.outputPath 
    });

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // Add input videos
      options.videoPaths.forEach(videoPath => {
        if (!fs.existsSync(videoPath)) {
          reject(new Error(`Video file not found: ${videoPath}`));
          return;
        }
        command = command.input(videoPath);
      });

      // Set output options
      command = command
        .on('start', (commandLine) => {
          logger.info('FFmpeg concatenation started', { commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('FFmpeg concatenation progress', { 
            percent: progress.percent,
            currentTime: progress.timemark 
          });
        })
        .on('end', () => {
          logger.info('Video concatenation completed', { outputPath: options.outputPath });
          resolve(options.outputPath);
        })
        .on('error', (err) => {
          logger.error('FFmpeg concatenation failed', { error: err.message });
          reject(new Error(`Video concatenation failed: ${err.message}`));
        });

      if (options.fadeTransition) {
        // Crossfade transitions between videos (video-only here). Audio is added later.
        const transitionDuration = options.transitionDuration || 0.5;
        const sceneDuration = options.sceneDuration || 5;
        const filterComplex = this.buildCrossfadeVideoFilter(options.videoPaths.length, transitionDuration, sceneDuration);
        command = command
          .complexFilter(filterComplex)
          .outputOptions('-map', '[outv]')
          .videoCodec('libx264')
          .noAudio(); // drop audio during concatenation; will be mixed later
      } else {
        // Simple concatenation (video-only). Audio will be mixed later.
        const concatInputs = this.buildConcatVideoInputs(options.videoPaths.length);
        const filterComplex = `${concatInputs}concat=n=${options.videoPaths.length}:v=1:a=0[outv]`;
        command = command
          .complexFilter(filterComplex)
          .outputOptions('-map', '[outv]')
          .videoCodec('libx264')
          .noAudio();
      }

      // Set output format and resolution
      command = command
        .outputOptions('-movflags', '+faststart') // Enable streaming
        .outputOptions('-r', '30') // Normalize fps
        .format('mp4');

      if (options.resolution) {
        command = command.size(options.resolution);
      }

      command.save(options.outputPath);
    });
  }

  async addAudioToVideo(videoPath: string, audioOptions: AudioMixOptions): Promise<string> {
    logger.info('Adding audio to video', { 
      videoPath,
      outputPath: audioOptions.outputPath 
    });

    return new Promise(async (resolve, reject) => {
      try {
        // Check if input video has audio
        const hasAudio = await this.checkVideoHasAudio(videoPath);
        
        let command = ffmpeg(videoPath);
        const filters: string[] = [];
        let audioInputIndex = 1; // Video is input 0

        // Add voiceover if provided
        if (audioOptions.voiceoverPath && fs.existsSync(audioOptions.voiceoverPath)) {
          command = command.input(audioOptions.voiceoverPath);
          audioInputIndex++;
        }

        // Add music if provided
        if (audioOptions.musicPath && fs.existsSync(audioOptions.musicPath)) {
          command = command.input(audioOptions.musicPath);
          audioInputIndex++;
        }

        // Build audio mixing filter with proper handling of missing audio
        if (audioInputIndex > 1) {
          const mixFilter = this.buildAudioMixFilter(audioOptions, audioInputIndex, hasAudio);
          filters.push(mixFilter);
        }

        command = command
          .on('start', (commandLine) => {
            logger.info('FFmpeg audio mixing started', { commandLine });
          })
          .on('progress', (progress) => {
            logger.debug('FFmpeg audio mixing progress', { 
              percent: progress.percent,
              currentTime: progress.timemark 
            });
          })
          .on('end', () => {
            logger.info('Audio mixing completed', { outputPath: audioOptions.outputPath });
            resolve(audioOptions.outputPath);
          })
          .on('error', (err) => {
            logger.error('FFmpeg audio mixing failed', { error: err.message });
            reject(new Error(`Audio mixing failed: ${err.message}`));
          });

        if (filters.length > 0) {
          command = command.complexFilter(filters.join(';'));
          // Explicit stream mapping when using complex filters
          command = command
            .outputOptions('-map', '0:v') // Map video from first input
            .outputOptions('-map', '[outa]') // Map mixed audio output
        } else {
          // No audio mixing needed, just copy streams
          command = command
            .outputOptions('-map', '0:v')
            .outputOptions('-map', '0:a?') // Optional audio mapping
        }

        command
          .videoCodec('copy') // Don't re-encode video
          .audioCodec('aac')
          .outputOptions('-shortest') // End at shortest stream
          .outputOptions('-movflags', '+faststart') // Enable streaming
          .format('mp4')
          .save(audioOptions.outputPath);
          
      } catch (error) {
        reject(error);
      }
    });
  }

  private buildConcatInputs(videoCount: number): string {
    const inputs: string[] = [];
    for (let i = 0; i < videoCount; i++) {
      inputs.push(`[${i}:v]`, `[${i}:a]`);
    }
    return inputs.join('');
  }

  private buildConcatVideoInputs(videoCount: number): string {
    const inputs: string[] = [];
    for (let i = 0; i < videoCount; i++) {
      inputs.push(`[${i}:v]`);
    }
    return inputs.join('');
  }

  private buildCrossfadeVideoFilter(videoCount: number, transitionDuration: number, sceneDuration: number = 5): string {
    if (videoCount < 2) return `[0:v]null[outv]`;

    const filters: string[] = [];
    // Video crossfades chain
    for (let i = 0; i < videoCount - 1; i++) {
      const prevLabel = i === 0 ? `[0:v]` : `[v${i}]`;
      const nextLabel = `[${i + 1}:v]`;
      const outputLabel = i === videoCount - 2 ? `[outv]` : `[v${i + 1}]`;
      const offset = i * sceneDuration; // seconds
      filters.push(`${prevLabel}${nextLabel}xfade=transition=fade:duration=${transitionDuration}:offset=${offset}${outputLabel}`);
    }
    return filters.join(';');
  }

  private buildAudioMixFilter(options: AudioMixOptions, inputCount: number, hasOriginalAudio: boolean = true): string {
    const voiceVolume = options.voiceVolume || 1.0;
    const musicVolume = options.musicVolume || 0.3;
    
    const filters: string[] = [];
    const inputs: string[] = [];
    let inputIndex = 1; // Start after video input (0)

    // Handle original audio with resampling
    if (hasOriginalAudio) {
      filters.push(`[0:a]aresample=async=1,volume=0.5[original]`);
      inputs.push('[original]');
    }
    
    // Handle voiceover
    if (options.voiceoverPath) {
      filters.push(`[${inputIndex}:a]aresample=async=1,volume=${voiceVolume}[voice]`);
      inputs.push('[voice]');
      inputIndex++;
    }
    
    // Handle music
    if (options.musicPath) {
      filters.push(`[${inputIndex}:a]aresample=async=1,volume=${musicVolume}[music]`);
      inputs.push('[music]');
      inputIndex++;
    }
    
    // Build the final amix filter
    if (inputs.length > 1) {
      filters.push(`${inputs.join('')}amix=inputs=${inputs.length}:normalize=0[outa]`);
    } else if (inputs.length === 1) {
      // Only one audio source, pass through to outa
      filters.push(`${inputs[0]}anull[outa]`);
    }
    
    return filters.join(';');
  }

  async checkVideoHasAudio(videoPath: string): Promise<boolean> {
    try {
      const metadata = await this.getVideoInfo(videoPath);
      return metadata.streams.some((stream: any) => stream.codec_type === 'audio');
    } catch (error) {
      logger.warn('Could not check audio streams, assuming no audio', { videoPath, error });
      return false;
    }
  }

  async getVideoInfo(videoPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('Failed to get video info', { error: err.message, videoPath });
          reject(err);
        } else {
          resolve(metadata);
        }
      });
    });
  }

  async extractVideoFrame(videoPath: string, timeSeconds: number, outputPath: string): Promise<string> {
    logger.info('Extracting video frame', { videoPath, timeSeconds, outputPath });

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timeSeconds)
        .frames(1)
        .output(outputPath)
        .on('end', () => {
          logger.info('Frame extracted successfully', { outputPath });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Frame extraction failed', { error: err.message });
          reject(err);
        })
        .run();
    });
  }

  async optimizeVideo(inputPath: string, outputPath: string, options?: {
    resolution?: string;
    bitrate?: string;
    fps?: number;
  }): Promise<string> {
    logger.info('Optimizing video', { inputPath, outputPath, options });

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      // Use proper scale filter for resolution instead of .size() for better control
      if (options?.resolution) {
        if (options.resolution.endsWith('p')) {
          const height = parseInt(options.resolution.replace('p', ''));
          command = command.outputOptions('-vf', `scale=-2:${height}`); // Width auto-calculated to even number
        } else {
          command = command.size(options.resolution);
        }
      }
      
      if (options?.bitrate) {
        command = command.videoBitrate(options.bitrate);
      }
      
      if (options?.fps) {
        command = command.fps(options.fps);
      }

      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .format('mp4')
        .outputOptions('-preset', 'fast')
        .outputOptions('-crf', '23')
        .outputOptions('-movflags', '+faststart') // Enable streaming
        .on('end', () => {
          logger.info('Video optimization completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Video optimization failed', { error: err.message });
          reject(err);
        })
        .save(outputPath);
    });
  }

  async concatenateVoiceovers(voiceoverPaths: string[], outputPath: string): Promise<string> {
    logger.info('Concatenating voiceovers', { 
      voiceoverCount: voiceoverPaths.length,
      outputPath 
    });

    const validPaths = voiceoverPaths.filter(path => path && fs.existsSync(path));
    if (validPaths.length === 0) {
      throw new Error('No valid voiceover files to concatenate');
    }

    if (validPaths.length === 1) {
      // Only one file, just copy it
      await fs.copy(validPaths[0], outputPath);
      return outputPath;
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg();

      // Add all voiceover inputs
      validPaths.forEach(path => {
        command = command.input(path);
      });

      // Normalize all inputs to consistent format (48kHz stereo, fltp) before concat
      const normalizedLabels = validPaths.map((_, i) => `a${i}`);
      const normalizeFilters = validPaths
        .map((_, i) => `[$
{i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[${normalizedLabels[i]}]`)
        .join(';');
      const concatInputs = normalizedLabels.map(l => `[${l}]`).join('');
      const filterComplex = `${normalizeFilters};${concatInputs}concat=n=${validPaths.length}:v=0:a=1[outa]`;

      command
        .complexFilter(filterComplex)
        .outputOptions('-map', '[outa]')
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('start', (commandLine) => {
          logger.info('FFmpeg voiceover concat started', { commandLine });
        })
        .on('end', () => {
          logger.info('Voiceover concatenation completed', { outputPath });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Voiceover concatenation failed', { error: err.message });
          reject(new Error(`Voiceover concatenation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }
}
