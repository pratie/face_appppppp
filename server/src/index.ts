import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { config, validateConfig } from './utils/config';
import { validateFFmpegOrFail } from './utils/ffmpegCheck';
import { MemoryManager, performanceMonitor } from './utils/performance';
import logger from './utils/logger';
import generationRoutes from './routes/generation';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from uploads
app.use('/images', express.static(config.imagesDir));
app.use('/video', express.static(config.videoDir));

// Serve final videos from runs directory
app.get('/api/video/:sessionId/final.mp4', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const videoPath = path.join(config.runsDir, sessionId, 'final_video.mp4');
    
    if (!(await fs.pathExists(videoPath))) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Set appropriate headers for video streaming
    const stat = await fs.stat(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }
      
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    logger.error('Error serving video:', error);
    res.status(500).json({ error: 'Failed to serve video' });
  }
});

// API routes
app.use('/api/generate', generationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const report = performanceMonitor.generateReport();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    performance: report,
    environment: config.nodeEnv
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

async function startServer() {
  try {
    // Validate configuration
    validateConfig();
    
    // Check FFMPEG availability
    await validateFFmpegOrFail();
    
    // Ensure directories exist
    await fs.ensureDir(config.imagesDir);
    await fs.ensureDir(config.videoDir);
    await fs.ensureDir(config.runsDir);
    logger.info('✓ Storage directories created/verified');

    // Start memory monitoring in production
    if (config.nodeEnv === 'production') {
      MemoryManager.startMonitoring();
      logger.info('✓ Memory monitoring started');
    }
    
    // Start server
    app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📁 Images: ${config.imagesDir}`);
      logger.info(`🎬 Videos: ${config.videoDir}`);
      logger.info(`🗃️  Runs: ${config.runsDir}`);
      logger.info(`🔧 Environment: ${config.nodeEnv}`);
      logger.info(`🎯 Max concurrent jobs: ${config.maxConcurrentJobs}`);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

startServer();