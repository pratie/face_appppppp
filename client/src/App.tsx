import React, { useState, useCallback } from 'react';
import { WebcamCapture } from './components/WebcamCapture';
import { ImageUpload } from './components/ImageUpload';
import { VideoConfigForm, VideoConfig } from './components/VideoConfigForm';
import VideoPlayer from './components/VideoPlayer';
import { GenerationResponse, SessionProgress } from './types';
import './App.css';

type AppStep = 'capture' | 'configure' | 'generating' | 'completed';

function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>('capture');
  const [characterImage, setCharacterImage] = useState<File | Blob | null>(null);
  const [characterImagePreview, setCharacterImagePreview] = useState<string | null>(null);
  const [sessionProgress, setSessionProgress] = useState<SessionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useWebcam, setUseWebcam] = useState<boolean>(true);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  // Handle character image capture/upload
  const handleImageCapture = useCallback((imageBlob: Blob) => {
    setCharacterImage(imageBlob);
    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCharacterImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(imageBlob);
    
    setCurrentStep('configure');
  }, []);

  const handleImageUpload = useCallback((file: File) => {
    setCharacterImage(file);
    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCharacterImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
    
    setCurrentStep('configure');
  }, []);

  // Handle video generation
  const handleGenerateVideo = useCallback(async (config: VideoConfig) => {
    if (!characterImage) {
      setError('No character image selected');
      return;
    }

    setCurrentStep('generating');
    setError(null);

    try {
      // Create form data for the request
      const formData = new FormData();
      
      // Convert blob to file if needed
      if (characterImage instanceof Blob && !(characterImage instanceof File)) {
        const file = new File([characterImage], 'character.png', { type: 'image/png' });
        formData.append('characterImage', file);
      } else {
        formData.append('characterImage', characterImage);
      }
      
      formData.append('sceneCount', config.sceneCount.toString());
      formData.append('description', config.description);
      formData.append('includeMusic', config.includeMusic.toString());

      // Start generation
      const response = await fetch('/api/generate/start', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start generation');
      }

      const result: GenerationResponse = await response.json();
      
      // Start polling for progress
      pollProgress(result.sessionId);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setCurrentStep('configure');
    }
  }, [characterImage]);

  // Poll for generation progress
  const pollProgress = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/generate/status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error('Failed to get session status');
      }

      const status = await response.json();
      
      setSessionProgress({
        sessionId: status.sessionId,
        stages: status.stages,
        currentStage: status.currentStage,
        overallProgress: status.progress,
        startTime: status.createdAt,
        estimatedTimeRemaining: undefined // TODO: Calculate based on stage timings
      });

      // Check if generation is complete
      if (status.status === 'completed') {
        setFinalVideoUrl(status.finalVideoUrl);
        setCurrentStep('completed');
        return;
      }

      if (status.status === 'failed') {
        setError(status.error || 'Generation failed');
        setCurrentStep('configure');
        return;
      }

      // Continue polling if still processing
      if (status.status === 'processing') {
        setTimeout(() => pollProgress(sessionId), 2000); // Poll every 2 seconds
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get progress');
      setCurrentStep('configure');
    }
  }, []);

  // Reset to start over
  const handleStartOver = useCallback(() => {
    setCurrentStep('capture');
    setCharacterImage(null);
    setCharacterImagePreview(null);
    setSessionProgress(null);
    setError(null);
    setFinalVideoUrl(null);
  }, []);

  const renderStep = () => {
    switch (currentStep) {
      case 'capture':
        return (
          <div className="step-container">
            <h2>Step 1: Character Reference</h2>
            <p>Choose how you'd like to provide your character reference image:</p>
            
            <div style={{ marginBottom: '2rem' }}>
              <button
                className={`btn ${useWebcam ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setUseWebcam(true)}
                style={{ marginRight: '1rem' }}
              >
                📷 Use Webcam
              </button>
              <button
                className={`btn ${!useWebcam ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setUseWebcam(false)}
              >
                📁 Upload Image
              </button>
            </div>

            {useWebcam ? (
              <WebcamCapture onCapture={handleImageCapture} />
            ) : (
              <ImageUpload onUpload={handleImageUpload} />
            )}
          </div>
        );

      case 'configure':
        return (
          <div className="step-container">
            <h2>Step 2: Video Configuration</h2>
            
            {characterImagePreview && (
              <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <img
                  src={characterImagePreview}
                  alt="Character reference"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    border: '2px solid #ddd'
                  }}
                />
                <p style={{ marginTop: '0.5rem', fontSize: '14px', color: '#666' }}>
                  Character Reference Image
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={handleStartOver}
                  style={{ marginTop: '0.5rem' }}
                >
                  Choose Different Image
                </button>
              </div>
            )}

            <VideoConfigForm
              onSubmit={handleGenerateVideo}
              maxScenes={5}
              defaultScenes={3}
            />
          </div>
        );

      case 'generating':
        return (
          <div className="step-container">
            <h2>Generating Your Video</h2>
            <p>Please wait while we create your character-consistent video...</p>
            
            {sessionProgress && (
              <div className="progress-container">
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <span>Overall Progress</span>
                    <span>{sessionProgress.overallProgress}%</span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${sessionProgress.overallProgress}%`,
                      height: '100%',
                      backgroundColor: '#667eea',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {sessionProgress.stages.map((stage) => (
                  <div
                    key={stage.stage}
                    className={`progress-stage ${stage.status}`}
                  >
                    <div>
                      {stage.status === 'processing' && <div className="spinner" />}
                      {stage.status === 'completed' && <span>✓</span>}
                      {stage.status === 'error' && <span>✗</span>}
                      {stage.status === 'pending' && <span>⏳</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong>{stage.stage.toUpperCase()}</strong>
                      {stage.message && <div style={{ fontSize: '14px' }}>{stage.message}</div>}
                      {stage.error && <div style={{ fontSize: '14px', color: '#dc3545' }}>{stage.error}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="step-container">
            <h2>🎉 Video Generated!</h2>
            <div className="success-message">
              Your character-consistent video has been generated successfully!
            </div>
            
            {finalVideoUrl ? (
              <VideoPlayer
                videoUrl={finalVideoUrl}
                title="AI Generated Video"
                onReplay={handleStartOver}
                onDownload={() => {
                  console.log('Video downloaded');
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                <p>Video is being prepared for viewing...</p>
                <button
                  className="btn btn-primary"
                  onClick={handleStartOver}
                >
                  Generate Another Video
                </button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="App">
      <div className="container">
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            🎬 AI Video Generator
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#666', margin: 0 }}>
            Create character-consistent multi-scene videos from a single reference image
          </p>
          {currentStep !== 'capture' && (
            <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '0.5rem' }}>
              Complete Pipeline: Images → Videos → Audio → Merged Output
            </p>
          )}
        </header>

        <main className="card">
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          {renderStep()}
        </main>

        <footer style={{ 
          textAlign: 'center', 
          marginTop: '2rem', 
          fontSize: '0.9rem', 
          color: '#666' 
        }}>
          Powered by OpenAI GPT-5, Ideogram Character, Kling v2.1, and ElevenLabs
        </footer>
      </div>
    </div>
  );
}

export default App;
