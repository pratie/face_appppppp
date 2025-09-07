import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the server directory
dotenv.config();

interface Config {
  // API Keys
  openaiApiKey: string;
  elevenlabsApiKey: string;
  replicateApiToken: string;
  falApiKey: string;
  
  // Server
  port: number;
  nodeEnv: string;
  
  // File Paths
  imagesDir: string;
  videoDir: string;
  runsDir: string;
  
  // Processing
  maxConcurrentJobs: number;
  cleanupDays: number;
  defaultResolution: string;
  maxScenes: number;
  defaultScenes: number;
  sceneDurationSeconds: number;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getOptionalEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

// Support both REPLICATE_API_TOKEN and REPLICATE_API_KEY for backward compatibility
function getReplicateToken(): string {
  const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (!token) {
    throw new Error('Required environment variable REPLICATE_API_TOKEN or REPLICATE_API_KEY is not set');
  }
  return token;
}

export const config: Config = {
  // API Keys - all required
  openaiApiKey: getRequiredEnv('OPENAI_API_KEY'),
  elevenlabsApiKey: getRequiredEnv('ELEVENLABS_API_KEY'),
  replicateApiToken: getReplicateToken(),
  falApiKey: getRequiredEnv('FAL_API_KEY'),
  
  // Server configuration
  port: getOptionalEnvNumber('PORT', 5000),
  nodeEnv: getOptionalEnv('NODE_ENV', 'development'),
  
  // File paths (relative to project root)
  imagesDir: path.resolve(getOptionalEnv('IMAGES_DIR', './images')),
  videoDir: path.resolve(getOptionalEnv('VIDEO_DIR', './video')),
  runsDir: path.resolve(getOptionalEnv('RUNS_DIR', './runs')),
  
  // Processing configuration
  maxConcurrentJobs: getOptionalEnvNumber('MAX_CONCURRENT_JOBS', 1),
  cleanupDays: getOptionalEnvNumber('CLEANUP_DAYS', 7),
  defaultResolution: getOptionalEnv('DEFAULT_RESOLUTION', '720p'),
  maxScenes: getOptionalEnvNumber('MAX_SCENES', 5),
  defaultScenes: getOptionalEnvNumber('DEFAULT_SCENES', 3),
  sceneDurationSeconds: getOptionalEnvNumber('SCENE_DURATION_SECONDS', 5),
};

export function validateConfig(): void {
  console.log('✓ Configuration loaded successfully');
  console.log(`  - Environment: ${config.nodeEnv}`);
  console.log(`  - Port: ${config.port}`);
  console.log(`  - Max scenes: ${config.maxScenes}`);
  console.log(`  - Default scenes: ${config.defaultScenes}`);
  console.log(`  - Scene duration: ${config.sceneDurationSeconds}s`);
  console.log(`  - Images dir: ${config.imagesDir}`);
  console.log(`  - Video dir: ${config.videoDir}`);
  console.log(`  - Runs dir: ${config.runsDir}`);
}