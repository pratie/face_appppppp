import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface FFmpegInfo {
  available: boolean;
  version?: string;
  error?: string;
}

export async function checkFFmpeg(): Promise<FFmpegInfo> {
  try {
    const { stdout } = await execAsync('ffmpeg -version');
    const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    
    return {
      available: true,
      version
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      available: false,
      error: errorMessage
    };
  }
}

export async function validateFFmpegOrFail(): Promise<void> {
  const ffmpegInfo = await checkFFmpeg();
  
  if (!ffmpegInfo.available) {
    const errorMsg = [
      'FFMPEG is not available on this system.',
      'Please install FFMPEG to use this application.',
      '',
      'Installation instructions:',
      '- macOS: brew install ffmpeg',
      '- Ubuntu/Debian: sudo apt install ffmpeg',
      '- Windows: Download from https://ffmpeg.org/download.html',
      '',
      `Error: ${ffmpegInfo.error}`
    ].join('\n');
    
    throw new Error(errorMsg);
  }
  
  console.log(`✓ FFMPEG detected (version: ${ffmpegInfo.version})`);
}