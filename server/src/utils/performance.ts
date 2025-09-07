import logger from './logger';
import { config } from './config';
import fs from 'fs-extra';
import path from 'path';

export interface PerformanceMetrics {
  operation: string;
  sessionId?: string;
  stage?: string;
  duration: number;
  success: boolean;
  memoryUsage?: NodeJS.MemoryUsage;
  fileSize?: number;
  timestamp: string;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private activeOperations = new Map<string, { start: number; operation: string }>();

  startOperation(operationId: string, operation: string, sessionId?: string): void {
    this.activeOperations.set(operationId, {
      start: Date.now(),
      operation
    });
  }

  endOperation(
    operationId: string, 
    success: boolean, 
    sessionId?: string, 
    stage?: string,
    additionalData?: { fileSize?: number }
  ): void {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) return;

    const duration = Date.now() - activeOp.start;
    const metrics: PerformanceMetrics = {
      operation: activeOp.operation,
      sessionId,
      stage,
      duration,
      success,
      memoryUsage: process.memoryUsage(),
      fileSize: additionalData?.fileSize,
      timestamp: new Date().toISOString()
    };

    this.metrics.push(metrics);
    this.activeOperations.delete(operationId);

    // Log performance data
    logger.info('Operation completed', {
      operation: metrics.operation,
      duration: `${duration}ms`,
      success,
      memoryMB: Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024),
      sessionId,
      stage
    });

    // Clean up old metrics (keep last 1000 entries)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  getMetrics(sessionId?: string): PerformanceMetrics[] {
    if (sessionId) {
      return this.metrics.filter(m => m.sessionId === sessionId);
    }
    return this.metrics;
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.metrics.filter(m => m.operation === operation && m.success);
    if (operationMetrics.length === 0) return 0;
    
    const totalTime = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return totalTime / operationMetrics.length;
  }

  generateReport(): {
    totalOperations: number;
    successRate: number;
    averageTimes: { [operation: string]: number };
    memoryUsage: NodeJS.MemoryUsage;
  } {
    const totalOperations = this.metrics.length;
    const successfulOps = this.metrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? (successfulOps / totalOperations) * 100 : 0;

    const operationGroups = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.operation]) acc[metric.operation] = [];
      acc[metric.operation].push(metric);
      return acc;
    }, {} as { [key: string]: PerformanceMetrics[] });

    const averageTimes = Object.keys(operationGroups).reduce((acc, operation) => {
      acc[operation] = this.getAverageTime(operation);
      return acc;
    }, {} as { [operation: string]: number });

    return {
      totalOperations,
      successRate: Math.round(successRate * 100) / 100,
      averageTimes,
      memoryUsage: process.memoryUsage()
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Memory management utilities
export class MemoryManager {
  private static readonly MEMORY_THRESHOLD_MB = 1024; // 1GB
  private static readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

  static startMonitoring(): void {
    setInterval(() => {
      this.checkMemoryUsage();
    }, this.CLEANUP_INTERVAL_MS);
  }

  static checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;

    logger.info('Memory usage check', {
      heapUsedMB: Math.round(heapUsedMB),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024)
    });

    if (heapUsedMB > this.MEMORY_THRESHOLD_MB) {
      logger.warn('High memory usage detected, running cleanup', { heapUsedMB });
      this.performCleanup();
    }
  }

  static performCleanup(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('Forced garbage collection completed');
    }

    // Clean up old session files
    this.cleanupOldSessionFiles();
  }

  static async cleanupOldSessionFiles(): Promise<void> {
    try {
      const runsDir = config.runsDir;
      const dirs = await fs.readdir(runsDir);
      const cutoffTime = Date.now() - (config.cleanupDays * 24 * 60 * 60 * 1000);

      let cleanedCount = 0;
      for (const dir of dirs) {
        const dirPath = path.join(runsDir, dir);
        const stats = await fs.stat(dirPath);
        
        if (stats.isDirectory() && stats.mtime.getTime() < cutoffTime) {
          try {
            await fs.remove(dirPath);
            cleanedCount++;
          } catch (error) {
            logger.warn('Failed to cleanup session directory', { dir, error });
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info('Session cleanup completed', { cleanedCount });
      }
    } catch (error) {
      logger.error('Session cleanup failed', { error });
    }
  }
}

// Resource optimization utilities
export class ResourceOptimizer {
  static async optimizeImage(inputPath: string, outputPath: string, maxWidth: number = 1024): Promise<void> {
    // This would use sharp or similar library for image optimization
    // For now, just copy the file
    await fs.copy(inputPath, outputPath);
  }

  static async estimateProcessingTime(sceneCount: number, includeVoiceover: boolean, includeMusic: boolean): Promise<number> {
    // Base time estimates (in seconds)
    const baseTimePerScene = {
      prompts: 5,
      image: 20,
      video: 60,
      audio: includeVoiceover ? 10 : 0,
      music: includeMusic ? 30 : 0,
      merge: 15
    };

    const totalTime = sceneCount * (
      baseTimePerScene.prompts +
      baseTimePerScene.image +
      baseTimePerScene.video
    ) + baseTimePerScene.audio + baseTimePerScene.music + baseTimePerScene.merge;

    // Add buffer for processing overhead (20%)
    return Math.round(totalTime * 1.2);
  }

  static getOptimalConcurrency(): number {
    const cpuCount = require('os').cpus().length;
    return Math.max(1, Math.floor(cpuCount / 2));
  }

  static async checkDiskSpace(path: string): Promise<{ available: number; total: number }> {
    try {
      const stats = await fs.statfs(path);
      return {
        available: stats.bavail * stats.bsize,
        total: stats.blocks * stats.bsize
      };
    } catch {
      // Fallback - assume we have space
      return { available: 10 * 1024 * 1024 * 1024, total: 100 * 1024 * 1024 * 1024 }; // 10GB available, 100GB total
    }
  }
}

// Rate limiting for external API calls
export class RateLimiter {
  private requests = new Map<string, number[]>();
  private limits = new Map<string, { maxRequests: number; windowMs: number }>();

  constructor() {
    // Set default limits
    this.setLimit('openai', 60, 60000); // 60 requests per minute
    this.setLimit('ideogram', 30, 60000); // 30 requests per minute
    this.setLimit('kling', 10, 60000); // 10 requests per minute
    this.setLimit('elevenlabs', 100, 60000); // 100 requests per minute
  }

  setLimit(service: string, maxRequests: number, windowMs: number): void {
    this.limits.set(service, { maxRequests, windowMs });
  }

  async checkLimit(service: string): Promise<boolean> {
    const limit = this.limits.get(service);
    if (!limit) return true;

    const now = Date.now();
    const serviceRequests = this.requests.get(service) || [];
    
    // Clean old requests outside the window
    const recentRequests = serviceRequests.filter(time => now - time < limit.windowMs);
    
    if (recentRequests.length >= limit.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(service, recentRequests);
    
    return true;
  }

  async waitForLimit(service: string): Promise<void> {
    while (!(await this.checkLimit(service))) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }
  }

  getStatus(service: string): { current: number; limit: number; resetTime: number } {
    const limit = this.limits.get(service);
    if (!limit) return { current: 0, limit: 0, resetTime: Date.now() };

    const now = Date.now();
    const serviceRequests = this.requests.get(service) || [];
    const recentRequests = serviceRequests.filter(time => now - time < limit.windowMs);
    
    const oldestRequest = recentRequests[0];
    const resetTime = oldestRequest ? oldestRequest + limit.windowMs : now;

    return {
      current: recentRequests.length,
      limit: limit.maxRequests,
      resetTime
    };
  }
}

export const rateLimiter = new RateLimiter();