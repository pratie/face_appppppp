import React, { useRef, useState, useCallback } from 'react';

interface WebcamCaptureProps {
  onCapture: (imageBlob: Blob) => void;
  disabled?: boolean;
}

export const WebcamCapture: React.FC<WebcamCaptureProps> = ({ 
  onCapture, 
  disabled = false 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startWebcam = useCallback(async () => {
    try {
      setError(null);
      setPermissionDenied(false);
      
      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video metadata to be loaded before playing
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const video = videoRef.current;
          
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve(undefined);
          };
          
          const onError = () => {
            video.removeEventListener('error', onError);
            reject(new Error('Video metadata failed to load'));
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
          
          // If metadata is already loaded
          if (video.readyState >= 1) {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve(undefined);
          }
        });
        
        // Attempt to play video with Chrome-compatible handling
        try {
          await videoRef.current.play();
          setIsStreaming(true);
        } catch (playError) {
          console.error('Video play failed:', playError);
          throw new Error(`Failed to start video playback: ${playError instanceof Error ? playError.message : String(playError)}`);
        }
      }
      
    } catch (err) {
      console.error('Error accessing webcam:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionDenied(true);
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera is already in use by another application.');
        } else if (err.name === 'NotSupportedError') {
          setError('Camera constraints not supported. Please try a different browser.');
        } else if (err.name === 'OverconstrainedError') {
          setError('Camera constraints too restrictive. Trying with fallback settings...');
          // Retry with fallback constraints
          tryFallbackConstraints();
          return;
        } else if (err.message.includes('play')) {
          setError('Chrome autoplay policy blocked video. Please interact with the page and try again.');
        } else if (err.message.includes('HTTPS')) {
          setError('Camera requires HTTPS. Please use a secure connection or localhost.');
        } else {
          setError(`Camera error: ${err.message}`);
        }
      } else {
        setError('Unknown camera error occurred.');
      }
    }
  }, []);

  const tryFallbackConstraints = useCallback(async () => {
    try {
      setError(null);
      
      // Simpler constraints as fallback
      const fallbackConstraints = {
        video: {
          width: { min: 320, ideal: 640, max: 1920 },
          height: { min: 240, ideal: 480, max: 1080 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video metadata with fallback constraints
        await new Promise((resolve, reject) => {
          if (!videoRef.current) {
            reject(new Error('Video element not found'));
            return;
          }
          
          const video = videoRef.current;
          
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve(undefined);
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          
          if (video.readyState >= 1) {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            resolve(undefined);
          }
        });
        
        try {
          await videoRef.current.play();
          setIsStreaming(true);
          setError('Camera started with fallback settings.');
        } catch (playError) {
          throw new Error(`Fallback video play failed: ${playError instanceof Error ? playError.message : String(playError)}`);
        }
      }
      
    } catch (fallbackError) {
      console.error('Fallback constraints also failed:', fallbackError);
      setError('All camera settings failed. Please check your camera permissions and try again.');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const captureImage = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    
    setIsCapturing(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Could not get canvas context');
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || video.clientWidth;
      canvas.height = video.videoHeight || video.clientHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          onCapture(blob);
          stopWebcam(); // Stop webcam after successful capture
        }
        setIsCapturing(false);
      }, 'image/png', 0.9);
      
    } catch (err) {
      console.error('Error capturing image:', err);
      setError('Failed to capture image. Please try again.');
      setIsCapturing(false);
    }
  }, [onCapture, stopWebcam, isCapturing]);

  // Check if webcam API is available
  const isWebcamSupported = typeof navigator !== 'undefined' && 
                           navigator.mediaDevices && 
                           navigator.mediaDevices.getUserMedia;

  if (!isWebcamSupported) {
    return (
      <div className="webcam-container">
        <div className="webcam-overlay">
          <p>Webcam not supported in this browser</p>
          <p>Please use a modern browser or upload an image instead</p>
        </div>
      </div>
    );
  }

  return (
    <div className="webcam-container">
      <video
        ref={videoRef}
        className="webcam-video"
        style={{ display: isStreaming ? 'block' : 'none' }}
        muted
        playsInline
        autoPlay
      />
      
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
      
      {!isStreaming && (
        <div className="webcam-overlay">
          {error ? (
            <>
              <p>⚠️ {error}</p>
              {!permissionDenied && (
                <button 
                  className="btn btn-primary"
                  onClick={startWebcam}
                  disabled={disabled}
                >
                  Try Again
                </button>
              )}
            </>
          ) : (
            <>
              <p>📷 Ready to capture your character reference</p>
              <button 
                className="btn btn-primary"
                onClick={startWebcam}
                disabled={disabled}
              >
                Start Camera
              </button>
            </>
          )}
        </div>
      )}
      
      {isStreaming && (
        <div style={{ 
          position: 'absolute', 
          bottom: '1rem', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '1rem'
        }}>
          <button
            className="btn btn-primary"
            onClick={captureImage}
            disabled={disabled || isCapturing}
          >
            {isCapturing ? (
              <>
                <div className="spinner" />
                Capturing...
              </>
            ) : (
              '📸 Capture'
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={stopWebcam}
            disabled={disabled}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};