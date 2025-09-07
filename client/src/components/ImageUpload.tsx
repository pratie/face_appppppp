import React, { useRef, useState, useCallback } from 'react';

interface ImageUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUpload, 
  disabled = false,
  acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
  maxSizeMB = 10
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!acceptedTypes.includes(file.type)) {
      return `Invalid file type. Please upload: ${acceptedTypes.join(', ')}`;
    }

    // Check file size (convert MB to bytes)
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${maxSizeMB}MB`;
    }

    return null;
  }, [acceptedTypes, maxSizeMB]);

  const handleFile = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      return;
    }

    setError(null);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Call upload handler
    onUpload(file);
  }, [validateFile, onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      handleFile(file);
    }
  }, [handleFile, disabled]);

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const clearSelection = useCallback(() => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      {preview ? (
        <div className="upload-preview">
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={preview}
              alt="Upload preview"
              style={{
                maxWidth: '100%',
                maxHeight: '300px',
                borderRadius: '8px',
                display: 'block'
              }}
            />
            <button
              className="btn btn-danger"
              onClick={clearSelection}
              disabled={disabled}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                minWidth: 'auto',
                padding: '0.25rem 0.5rem',
                fontSize: '12px'
              }}
            >
              ✕
            </button>
          </div>
          <p style={{ 
            marginTop: '0.5rem', 
            fontSize: '14px', 
            color: '#666',
            textAlign: 'center' 
          }}>
            Character reference image ready
          </p>
        </div>
      ) : (
        <div
          className={`upload-area ${dragOver ? 'dragover' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={handleClick}
          style={{
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>
              📸
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>
              Upload Character Image
            </h3>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Drag and drop an image here, or click to browse
            </p>
            <p style={{ fontSize: '14px', color: '#888' }}>
              Supported: PNG, JPG, WebP • Max size: {maxSizeMB}MB
            </p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="error-message" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}
    </div>
  );
};