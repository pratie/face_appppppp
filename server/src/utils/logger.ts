import winston from 'winston';
import { config } from './config';

const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'webcam-ai-video' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf((info) => {
          const { level, message, timestamp, sessionId, stage, ...metadata } = info;
          const sessionInfo = sessionId ? `[${sessionId}]` : '';
          const stageInfo = stage ? `[${stage}]` : '';
          
          let output = `${timestamp} ${level}: ${sessionInfo}${stageInfo} ${message}`;
          
          // Add important fields on new lines for readability
          if (metadata.status) output += `\n  Status: ${metadata.status}`;
          if (metadata.error) output += `\n  Error: ${metadata.error}`;
          if (metadata.logs) output += `\n  Logs: ${metadata.logs}`;
          if (metadata.predictionId) output += `\n  PredictionId: ${metadata.predictionId}`;
          if (metadata.elapsedSeconds) output += `\n  ElapsedSeconds: ${metadata.elapsedSeconds}`;
          if (metadata.finalStatus) output += `\n  FinalStatus: ${metadata.finalStatus}`;
          if (metadata.elapsedTime) output += `\n  ElapsedTime: ${metadata.elapsedTime}s`;
          if (metadata.fullPrediction) output += `\n  FullPrediction: ${metadata.fullPrediction}`;
          
          // Add any remaining metadata
          const remainingKeys = Object.keys(metadata).filter(k => 
            !['status', 'error', 'logs', 'predictionId', 'elapsedSeconds', 'finalStatus', 'elapsedTime', 'fullPrediction'].includes(k)
          );
          if (remainingKeys.length > 0) {
            const remaining = remainingKeys.reduce((obj, key) => {
              obj[key] = metadata[key];
              return obj;
            }, {});
            output += `\n  Additional: ${JSON.stringify(remaining)}`;
          }
          
          return output;
        })
      )
    })
  ]
});

// Add file logging for both development and production
logger.add(new winston.transports.File({
  filename: 'logs/error.log',
  level: 'error',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
}));

logger.add(new winston.transports.File({
  filename: 'logs/combined.log',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
}));

export default logger;