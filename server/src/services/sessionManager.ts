import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { config } from '../utils/config';
import logger from '../utils/logger';
import { GenerationSession, GenerationRequest, ProcessingStage, StageStatus } from '../types';

export class SessionManager {
  private sessions = new Map<string, GenerationSession>();

  createSession(request: GenerationRequest, characterImagePath: string): GenerationSession {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();

    // Initialize all stages as pending
    const stages: StageStatus[] = [
      { stage: 'prompts', status: 'pending' },
      { stage: 'images', status: 'pending' },
      { stage: 'videos', status: 'pending' }
    ];

    // Add audio stage if either voiceover or music is requested
    if (request.includeVoiceover || request.includeMusic) {
      stages.push({ stage: 'audio', status: 'pending' });
    }
    
    // Merge is always last
    stages.push({ stage: 'merge', status: 'pending' });

    const session: GenerationSession = {
      sessionId,
      request,
      characterImagePath,
      status: 'pending',
      stages,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.sessions.set(sessionId, session);
    
    logger.info('Created new generation session', {
      sessionId,
      sceneCount: request.sceneCount,
      includeVoiceover: request.includeVoiceover,
      includeMusic: request.includeMusic
    });

    return session;
  }

  getSession(sessionId: string): GenerationSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateSessionStatus(sessionId: string, status: GenerationSession['status'], error?: string, errorDetails?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update non-existent session', { sessionId });
      return;
    }

    session.status = status;
    session.updatedAt = new Date().toISOString();
    
    if (error) {
      session.error = error;
      if (errorDetails) {
        (session as any).errorDetails = errorDetails;
      }
    }

    logger.info('Updated session status', { sessionId, status, error });
  }

  updateStageStatus(
    sessionId: string, 
    stage: ProcessingStage, 
    status: StageStatus['status'],
    message?: string,
    progress?: number,
    error?: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to update stage for non-existent session', { sessionId, stage });
      return;
    }

    const stageIndex = session.stages.findIndex(s => s.stage === stage);
    if (stageIndex === -1) {
      logger.warn('Attempted to update non-existent stage', { sessionId, stage });
      return;
    }

    const stageStatus = session.stages[stageIndex];
    const timestamp = new Date().toISOString();

    // Update stage status
    stageStatus.status = status;
    stageStatus.message = message;
    stageStatus.progress = progress;
    stageStatus.error = error;

    // Set timestamps
    if (status === 'processing' && !stageStatus.startTime) {
      stageStatus.startTime = timestamp;
      session.currentStage = stage;
    } else if (status === 'completed' || status === 'error') {
      stageStatus.endTime = timestamp;
      
      // Clear current stage if this stage is done
      if (session.currentStage === stage) {
        session.currentStage = undefined;
      }
    }

    session.updatedAt = timestamp;

    logger.info('Updated stage status', {
      sessionId,
      stage,
      status,
      message,
      progress,
      error
    });
  }

  updateSessionFinalVideo(sessionId: string, videoPath: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn('Attempted to set final video for non-existent session', { sessionId });
      return;
    }

    session.finalVideoPath = videoPath;
    session.updatedAt = new Date().toISOString();
    
    logger.info('Set final video path', { sessionId, videoPath });
  }

  async ensureSessionDirectories(sessionId: string): Promise<void> {
    const directories = [
      path.join(config.imagesDir, sessionId),
      path.join(config.videoDir, sessionId),
      path.join(config.runsDir, sessionId)
    ];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }

    logger.debug('Ensured session directories exist', { sessionId, directories });
  }

  async saveSessionArtifacts(sessionId: string, artifacts: any): Promise<void> {
    const artifactsPath = path.join(config.runsDir, sessionId, 'artifacts.json');
    
    try {
      await fs.writeJson(artifactsPath, {
        sessionId,
        timestamp: new Date().toISOString(),
        ...artifacts
      }, { spaces: 2 });
      
      logger.debug('Saved session artifacts', { sessionId, artifactsPath });
    } catch (error) {
      logger.error('Failed to save session artifacts', { sessionId, error });
    }
  }

  getSessionProgress(sessionId: string): { progress: number; currentStage?: ProcessingStage } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { progress: 0 };
    }

    const totalStages = session.stages.length;
    const completedStages = session.stages.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedStages / totalStages) * 100);

    return {
      progress,
      currentStage: session.currentStage
    };
  }

  // Cleanup old sessions (call this periodically)
  cleanupOldSessions(maxAgeHours: number = 24): number {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - maxAgeHours);

    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionTime = new Date(session.createdAt);
      
      if (sessionTime < cutoffTime) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        
        logger.info('Cleaned up old session', { 
          sessionId, 
          age: Math.round((Date.now() - sessionTime.getTime()) / (1000 * 60 * 60)) 
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('Session cleanup completed', { cleanedCount, remainingSessions: this.sessions.size });
    }

    return cleanedCount;
  }

  getAllActiveSessions(): GenerationSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.status === 'processing' || session.status === 'pending');
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}