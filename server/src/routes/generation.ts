import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { config } from '../utils/config';
import { VideoGeneratorService } from '../services/videoGenerator';
import { SessionManager } from '../services/sessionManager';
import logger from '../utils/logger';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(config.imagesDir, 'uploads');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `character-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and WebP are allowed.'));
    }
  }
});

// Initialize services
const sessionManager = new SessionManager();
const videoGenerator = new VideoGeneratorService(sessionManager);

// Start generation endpoint
router.post('/start', upload.single('characterImage'), async (req, res) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No character image uploaded',
        message: 'Please upload a character reference image'
      });
    }

    // Validate request body
    const { sceneCount, description, includeVoiceover, includeMusic } = req.body;

    if (!sceneCount || !description) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Scene count and description are required'
      });
    }

    const parsedSceneCount = parseInt(sceneCount, 10);
    if (isNaN(parsedSceneCount) || parsedSceneCount < 1 || parsedSceneCount > config.maxScenes) {
      return res.status(400).json({
        error: 'Invalid scene count',
        message: `Scene count must be between 1 and ${config.maxScenes}`
      });
    }

    if (typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({
        error: 'Invalid description',
        message: 'Description must be at least 10 characters long'
      });
    }

    // Parse image options (support both JSON string or flat fields for form-data flexibility)
    let imageOptions: any | undefined = undefined;
    try {
      if (req.body.imageOptions) {
        const raw = typeof req.body.imageOptions === 'string' ? req.body.imageOptions : JSON.stringify(req.body.imageOptions);
        imageOptions = JSON.parse(raw);
      } else if (req.body.imageProvider || req.body.imageOutputFormat || typeof req.body.includeOriginalAnchor !== 'undefined') {
        imageOptions = {
          provider: req.body.imageProvider,
          outputFormat: req.body.imageOutputFormat,
          includeOriginalAnchor: req.body.includeOriginalAnchor === 'true' || req.body.includeOriginalAnchor === true
        };
      }
    } catch (e) {
      logger.warn('Failed to parse imageOptions; falling back to defaults', { provided: req.body.imageOptions, error: e instanceof Error ? e.message : String(e) });
      imageOptions = undefined;
    }

    const generationRequest = {
      sceneCount: parsedSceneCount,
      description: description.trim(),
      includeVoiceover: includeVoiceover === 'true',
      includeMusic: includeMusic === 'true',
      imageOptions
    };

    // Debug: Log file details
    logger.info('File upload details', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      destination: req.file.destination
    });

    // Verify file exists on disk
    const fileExists = await fs.pathExists(req.file.path);
    logger.info('Character image file verification', {
      path: req.file.path,
      exists: fileExists,
      size: fileExists ? (await fs.stat(req.file.path)).size : 'N/A'
    });

    if (!fileExists) {
      throw new Error(`Character image file not found at ${req.file.path}`);
    }

    logger.info('Starting video generation', {
      characterImage: req.file.filename,
      request: generationRequest
    });

    // Start generation (non-blocking)
    const sessionId = await videoGenerator.generateVideo(
      generationRequest,
      req.file.path
    );

    res.json({
      sessionId,
      status: 'started',
      message: 'Video generation started successfully'
    });

  } catch (error) {
    logger.error('Failed to start video generation', { error });
    
    // Clean up uploaded file if generation failed to start
    if (req.file) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup uploaded file', { file: req.file.path, error: cleanupError });
      }
    }

    res.status(500).json({
      error: 'Failed to start generation',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get session status endpoint
router.get('/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await videoGenerator.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `No generation session found with ID: ${sessionId}`
      });
    }

    const progress = await videoGenerator.getSessionProgress(sessionId);

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      currentStage: session.currentStage,
      stages: session.stages,
      progress: progress.progress,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      error: session.error,
      finalVideoUrl: session.finalVideoPath ? `/api/video/${sessionId}/final.mp4` : undefined
    });

  } catch (error) {
    logger.error('Failed to get session status', { sessionId: req.params.sessionId, error });
    res.status(500).json({
      error: 'Failed to get session status',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get session artifacts (for debugging)
router.get('/artifacts/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await videoGenerator.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        message: `No generation session found with ID: ${sessionId}`
      });
    }

    const artifactsPath = path.join(config.runsDir, sessionId, 'artifacts.json');
    
    if (await fs.pathExists(artifactsPath)) {
      const artifacts = await fs.readJson(artifactsPath);
      res.json(artifacts);
    } else {
      res.json({ message: 'No artifacts available yet' });
    }

  } catch (error) {
    logger.error('Failed to get session artifacts', { sessionId: req.params.sessionId, error });
    res.status(500).json({
      error: 'Failed to get artifacts',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Health check for services
router.get('/health', async (req, res) => {
  try {
    const services = await videoGenerator.testServices();
    const allHealthy = Object.values(services).every(status => status === true);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;