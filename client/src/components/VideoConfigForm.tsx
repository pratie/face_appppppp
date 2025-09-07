import React, { useState, useCallback } from 'react';

export interface VideoConfig {
  sceneCount: number;
  description: string;
  includeMusic: boolean;
}

interface VideoConfigFormProps {
  onSubmit: (config: VideoConfig) => void;
  disabled?: boolean;
  maxScenes?: number;
  defaultScenes?: number;
}

export const VideoConfigForm: React.FC<VideoConfigFormProps> = ({
  onSubmit,
  disabled = false,
  maxScenes = 5,
  defaultScenes = 3
}) => {
  const [config, setConfig] = useState<VideoConfig>({
    sceneCount: defaultScenes,
    description: '',
    includeMusic: true
  });

  const [errors, setErrors] = useState<Partial<Record<keyof VideoConfig, string>>>({});

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof VideoConfig, string>> = {};

    // Validate scene count
    if (config.sceneCount < 1 || config.sceneCount > maxScenes) {
      newErrors.sceneCount = `Scene count must be between 1 and ${maxScenes}`;
    }

    // Validate description
    if (!config.description.trim()) {
      newErrors.description = 'Video description is required';
    } else if (config.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    } else if (config.description.trim().length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [config, maxScenes]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit({
        ...config,
        description: config.description.trim()
      });
    }
  }, [config, validateForm, onSubmit]);

  const handleSceneCountChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const sceneCount = parseInt(e.target.value, 10);
    setConfig(prev => ({ ...prev, sceneCount }));
    setErrors(prev => ({ ...prev, sceneCount: undefined }));
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const description = e.target.value;
    setConfig(prev => ({ ...prev, description }));
    setErrors(prev => ({ ...prev, description: undefined }));
  }, []);

  const handleMusicChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig(prev => ({ ...prev, includeMusic: e.target.checked }));
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="sceneCount">
          Number of Scenes (1-{maxScenes})
        </label>
        <select
          id="sceneCount"
          className={`form-control ${errors.sceneCount ? 'error' : ''}`}
          value={config.sceneCount}
          onChange={handleSceneCountChange}
          disabled={disabled}
        >
          {Array.from({ length: maxScenes }, (_, i) => i + 1).map(num => (
            <option key={num} value={num}>
              {num} scene{num !== 1 ? 's' : ''} 
              {num === defaultScenes ? ' (recommended)' : ''}
            </option>
          ))}
        </select>
        {errors.sceneCount && (
          <div className="error-message" style={{ marginTop: '0.5rem' }}>
            {errors.sceneCount}
          </div>
        )}
        <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
          Each scene will be approximately 5 seconds long
        </small>
      </div>

      <div className="form-group">
        <label htmlFor="description">
          Video Description
        </label>
        <textarea
          id="description"
          className={`form-control ${errors.description ? 'error' : ''}`}
          value={config.description}
          onChange={handleDescriptionChange}
          disabled={disabled}
          rows={4}
          placeholder="Describe the tone, setting, and action for your video. For example: 'A cheerful morning routine in a bright kitchen, making coffee and greeting the day with enthusiasm.'"
          maxLength={500}
        />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginTop: '0.5rem'
        }}>
          {errors.description ? (
            <div className="error-message" style={{ margin: 0, flex: 1 }}>
              {errors.description}
            </div>
          ) : (
            <small style={{ color: '#666' }}>
              This description will be used to generate prompts for all scenes
            </small>
          )}
          <small style={{ color: '#888', marginLeft: '1rem' }}>
            {config.description.length}/500
          </small>
        </div>
      </div>

      <div className="form-group">
        <label style={{ marginBottom: '1rem', display: 'block' }}>
          Audio Options
        </label>

        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1
        }}>
          <input
            type="checkbox"
            checked={config.includeMusic}
            onChange={handleMusicChange}
            disabled={disabled}
            style={{ margin: 0 }}
          />
          <span>Generate background music</span>
        </label>

        <small style={{ display: 'block', marginTop: '0.5rem', color: '#666' }}>
          Music increases processing time but enhances the final video
        </small>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={disabled || !config.description.trim()}
        style={{ width: '100%', fontSize: '18px', padding: '1rem' }}
      >
        {disabled ? (
          <>
            <div className="spinner" />
            Generating Video...
          </>
        ) : (
          `🎬 Generate ${config.sceneCount}-Scene Video`
        )}
      </button>
    </form>
  );
};
