import logger from './logger';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public retryable: boolean;
  public context?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    retryable: boolean = false,
    context?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.retryable = retryable;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: any) {
    super(message, 400, true, false, context);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: any) {
    super(`${service} service is currently unavailable`, 503, true, true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(service: string, retryAfter?: number) {
    super(`Rate limit exceeded for ${service}`, 429, true, true, { retryAfter });
  }
}

export class AuthenticationError extends AppError {
  constructor(service: string) {
    super(`Authentication failed for ${service}`, 401, true, false);
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(`${resource}${id ? ` with ID ${id}` : ''} not found`, 404, true, false);
  }
}

export class ProcessingTimeoutError extends AppError {
  constructor(stage: string, timeout: number) {
    super(`Processing timeout after ${timeout}ms in stage: ${stage}`, 408, true, true, { timeout, stage });
  }
}

export interface ErrorContext {
  sessionId?: string;
  stage?: string;
  service?: string;
  attempt?: number;
  originalError?: Error;
  timestamp?: string;
}

export function handleServiceError(error: any, context: ErrorContext): AppError {
  logger.error('Service error occurred', { error: error.message, context });

  // OpenAI specific errors
  if (error.code === 'insufficient_quota') {
    return new ServiceUnavailableError('OpenAI', {
      reason: 'quota_exceeded',
      originalError: error.message
    });
  }

  if (error.code === 'rate_limit_exceeded') {
    return new RateLimitError('OpenAI', error.retry_after);
  }

  // Replicate/Kling specific errors
  if (error.message && error.message.includes('prediction failed')) {
    return new ServiceUnavailableError('Kling Video Generation', {
      reason: 'prediction_failed',
      originalError: error.message
    });
  }

  // ElevenLabs specific errors
  if (error.message && error.message.includes('quota')) {
    return new ServiceUnavailableError('ElevenLabs', {
      reason: 'quota_exceeded',
      originalError: error.message
    });
  }

  // Network/timeout errors
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new ServiceUnavailableError(context.service || 'External Service', {
      reason: 'network_error',
      originalError: error.message
    });
  }

  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return new ProcessingTimeoutError(context.stage || 'unknown', 30000);
  }

  // FFmpeg specific errors
  if (error.message && error.message.includes('ffmpeg') || error.message?.includes('ffprobe')) {
    return new AppError('Video processing failed', 500, true, true, {
      reason: 'ffmpeg_error',
      originalError: error.message
    });
  }

  // File system errors
  if (error.code === 'ENOENT') {
    return new ResourceNotFoundError('File', error.path);
  }

  if (error.code === 'EACCES' || error.code === 'EPERM') {
    return new AppError('File permission denied', 500, true, false, {
      reason: 'permission_error',
      path: error.path
    });
  }

  if (error.code === 'ENOSPC') {
    return new AppError('Insufficient disk space', 507, true, false, {
      reason: 'disk_full'
    });
  }

  // Generic retryable errors
  if (error.message && (
    error.message.includes('502') ||
    error.message.includes('503') ||
    error.message.includes('504') ||
    error.message.includes('temporary')
  )) {
    return new AppError(error.message, 503, true, true, context);
  }

  // Default error handling
  return new AppError(
    error.message || 'An unexpected error occurred',
    500,
    true,
    false,
    context
  );
}

export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.3; // 30% jitter
  return Math.floor(exponentialDelay * (1 + jitter));
}

export function shouldRetry(error: AppError, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  if (!error.retryable) return false;
  
  // Don't retry validation errors
  if (error instanceof ValidationError) return false;
  
  // Don't retry authentication errors
  if (error instanceof AuthenticationError) return false;
  
  return true;
}

export interface ErrorSummary {
  message: string;
  type: string;
  retryable: boolean;
  context?: any;
  suggestions?: string[];
}

export function createErrorSummary(error: AppError): ErrorSummary {
  const suggestions: string[] = [];

  if (error instanceof ServiceUnavailableError) {
    suggestions.push('Check service status and API quotas');
    suggestions.push('Try again in a few minutes');
  }

  if (error instanceof RateLimitError) {
    suggestions.push('Wait for rate limit to reset');
    suggestions.push('Consider upgrading your API plan');
  }

  if (error instanceof ProcessingTimeoutError) {
    suggestions.push('Try with fewer scenes or shorter content');
    suggestions.push('Check your internet connection');
  }

  if (error.message.includes('ffmpeg')) {
    suggestions.push('Ensure FFmpeg is properly installed');
    suggestions.push('Check video file formats and codecs');
  }

  if (error.message.includes('quota') || error.message.includes('limit')) {
    suggestions.push('Check API key quotas and billing');
    suggestions.push('Try again later when quotas reset');
  }

  return {
    message: error.message,
    type: error.constructor.name,
    retryable: error.retryable,
    context: error.context,
    suggestions: suggestions.length > 0 ? suggestions : undefined
  };
}

export function logError(error: AppError, context: ErrorContext): void {
  const logData = {
    message: error.message,
    statusCode: error.statusCode,
    isOperational: error.isOperational,
    retryable: error.retryable,
    context: { ...error.context, ...context },
    stack: error.stack
  };

  if (error.statusCode >= 500) {
    logger.error('Application error', logData);
  } else {
    logger.warn('Client error', logData);
  }
}

// Graceful error recovery strategies
export interface RecoveryStrategy {
  name: string;
  canRecover: (error: AppError) => boolean;
  recover: (context: ErrorContext) => Promise<void>;
}

export const recoveryStrategies: RecoveryStrategy[] = [
  {
    name: 'cleanup-temp-files',
    canRecover: (error) => error.message.includes('disk space') || error.message.includes('ENOSPC'),
    recover: async (context) => {
      logger.info('Attempting to clean up temporary files', context);
      // Implementation would clean up temporary files
    }
  },
  {
    name: 'fallback-generation',
    canRecover: (error) => error instanceof ServiceUnavailableError && error.context?.service === 'video',
    recover: async (context) => {
      logger.info('Attempting fallback video generation', context);
      // Implementation would use alternative video generation approach
    }
  },
  {
    name: 'reduce-quality',
    canRecover: (error) => error instanceof ProcessingTimeoutError,
    recover: async (context) => {
      logger.info('Attempting to reduce processing quality for speed', context);
      // Implementation would retry with lower quality settings
    }
  }
];

export async function attemptRecovery(error: AppError, context: ErrorContext): Promise<boolean> {
  for (const strategy of recoveryStrategies) {
    if (strategy.canRecover(error)) {
      try {
        await strategy.recover(context);
        logger.info(`Recovery strategy '${strategy.name}' completed successfully`, context);
        return true;
      } catch (recoveryError) {
        logger.warn(`Recovery strategy '${strategy.name}' failed`, { 
          context,
          error: recoveryError 
        });
      }
    }
  }
  return false;
}