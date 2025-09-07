import logger from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: any) => boolean;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: (error: any) => {
    // Default: retry on network errors, timeouts, and 5xx status codes
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') {
      return true;
    }
    if (error?.response?.status >= 500) {
      return true;
    }
    if (error?.response?.status === 429) { // Rate limit
      return true;
    }
    return false;
  }
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: { sessionId?: string; stage?: string; operation?: string }
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          ...context,
          attempt,
          totalAttempts: opts.maxAttempts
        });
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      const isRetryable = opts.retryableErrors ? opts.retryableErrors(error) : true;
      const isLastAttempt = attempt === opts.maxAttempts;
      
      logger.warn('Operation failed', {
        ...context,
        attempt,
        totalAttempts: opts.maxAttempts,
        isRetryable,
        isLastAttempt,
        error: error instanceof Error ? error.message : String(error)
      });
      
      if (!isRetryable || isLastAttempt) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      );
      
      // Add some jitter to prevent thundering herd
      const jitteredDelay = delay + Math.random() * delay * 0.1;
      
      logger.info('Retrying operation after delay', {
        ...context,
        attempt,
        delayMs: Math.round(jitteredDelay),
        nextAttempt: attempt + 1
      });
      
      await sleep(jitteredDelay);
    }
  }
  
  logger.error('Operation failed after all retries', {
    ...context,
    totalAttempts: opts.maxAttempts,
    finalError: lastError instanceof Error ? lastError.message : String(lastError)
  });
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Specific retry configurations for different services
export const OPENAI_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  retryableErrors: (error: any) => {
    // OpenAI specific retryable errors
    if (error?.response?.status === 429) return true; // Rate limit
    if (error?.response?.status >= 500) return true; // Server errors
    if (error?.code === 'ECONNRESET') return true; // Connection reset
    return false;
  }
};

export const REPLICATE_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 5000,
  maxDelayMs: 60000,
  retryableErrors: (error: any) => {
    // Replicate specific retryable errors
    if (error?.response?.status === 429) return true; // Rate limit
    if (error?.response?.status >= 500) return true; // Server errors
    if (error?.response?.status === 503) return true; // Service unavailable
    return false;
  }
};

export const ELEVENLABS_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 3000,
  retryableErrors: (error: any) => {
    // ElevenLabs specific retryable errors
    if (error?.response?.status === 429) return true; // Rate limit
    if (error?.response?.status >= 500) return true; // Server errors
    return false;
  }
};