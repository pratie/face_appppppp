import React, { useRef, useState, useEffect } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  onReplay?: () => void;
  onDownload?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  title = "Generated Video",
  onReplay,
  onDownload 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [videoUrl]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (video) {
      const newTime = parseFloat(e.target.value);
      video.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const newVolume = parseFloat(e.target.value);
    if (video) {
      video.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (onDownload) {
      onDownload();
    }
  };

  return (
    <div className="video-player-container">
      <div className="video-player-header">
        <h3>{title}</h3>
        <div className="video-actions">
          {onReplay && (
            <button onClick={onReplay} className="action-button">
              🔄 Create Another
            </button>
          )}
          <button onClick={handleDownload} className="action-button download">
            ⬇️ Download
          </button>
        </div>
      </div>

      <div 
        className={`video-wrapper ${isFullscreen ? 'fullscreen' : ''}`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {isLoading && (
          <div className="video-loading">
            <div className="loading-spinner"></div>
            <p>Loading video...</p>
          </div>
        )}
        
        <video
          ref={videoRef}
          src={videoUrl}
          className="video-element"
          poster="/placeholder-video.png"
        />

        <div className={`video-controls ${showControls || !isPlaying ? 'visible' : ''}`}>
          <div className="controls-top">
            <button onClick={toggleFullscreen} className="fullscreen-button">
              {isFullscreen ? '📤' : '📱'}
            </button>
          </div>

          <div className="controls-bottom">
            <button onClick={togglePlay} className="play-button">
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            <div className="time-controls">
              <span className="time-display">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="seek-bar"
              />
              <span className="time-display">
                {formatTime(duration)}
              </span>
            </div>

            <div className="volume-controls">
              <span className="volume-icon">🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={handleVolumeChange}
                className="volume-bar"
              />
            </div>
          </div>
        </div>

        <div 
          className="video-overlay"
          onClick={togglePlay}
          style={{ display: isLoading ? 'none' : 'block' }}
        >
          {!isPlaying && !isLoading && (
            <div className="play-overlay">
              <button className="play-overlay-button">
                ▶️
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="video-info">
        <p className="video-description">
          Your AI-generated video is ready! This video was created using advanced AI models 
          for image-to-video conversion with character consistency across scenes.
        </p>
        <div className="video-stats">
          <span>Duration: {formatTime(duration)}</span>
          <span>Format: MP4</span>
          <span>Quality: HD</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;