import { useState, useRef, useCallback, useEffect } from 'react';
import {
  GrainWorkerManager,
  FILM_PRESETS,
  GrainSettings,
  GrainProcessingProgress,
} from './grain-worker-manager';
import { assertImageData, assertObject, assert } from './utils';
import './App.css';

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] =
    useState<GrainProcessingProgress>({ progress: 0, stage: '' });
  const [selectedPreset, setSelectedPreset] = useState('kodak-400');
  const [customSettings, setCustomSettings] = useState<GrainSettings>(
    FILM_PRESETS['kodak-400']
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string>('');
  const [initialZoom, setInitialZoom] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageViewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainWorkerRef = useRef<GrainWorkerManager | null>(null);

  // Initialize grain worker
  useEffect(() => {
    grainWorkerRef.current = new GrainWorkerManager();

    return () => {
      grainWorkerRef.current?.terminate();
    };
  }, []);

  // Keyboard shortcuts for comparison
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (processedImage && (event.key === ' ' || event.key === 'c')) {
        event.preventDefault();
        setShowOriginal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [processedImage]);

  const calculateZoom = useCallback(() => {
    if (image && imageRef.current && imageViewerRef.current) {
      const imageEl = imageRef.current;
      const containerEl = imageViewerRef.current;

      if (imageEl.naturalWidth > 0 && imageEl.naturalHeight > 0) {
        const CONTAINER_PADDING = 32; // 2rem padding
        const containerWidth = containerEl.clientWidth - CONTAINER_PADDING;
        const containerHeight = containerEl.clientHeight - CONTAINER_PADDING;
        const imageWidth = imageEl.naturalWidth;
        const imageHeight = imageEl.naturalHeight;

        const zoomX = containerWidth / imageWidth;
        const zoomY = containerHeight / imageHeight;
        const newZoom = Math.min(zoomX, zoomY);

        setZoom(newZoom);
        setInitialZoom(newZoom);
      }
    }
  }, [image]);

  // Recalculate zoom on image load and window resize
  useEffect(() => {
    if (image && imageRef.current && imageViewerRef.current) {
      const imageEl = imageRef.current;

      // If the image is already loaded (e.g., from cache), calculate zoom immediately.
      // Otherwise, wait for it to load to ensure naturalWidth/Height are available.
      if (imageEl.complete) {
        calculateZoom();
      } else {
        imageEl.onload = calculateZoom;
      }
    }

    // Debounced resize handler
    let resizeTimeout: number;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(calculateZoom, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [image, calculateZoom]);

  const processFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      // Store original file name for download purposes
      setOriginalFileName(file.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target?.result as string);
        setProcessedImage(null);
        // Zoom is now set in a useEffect when the image loads
        setPan({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const imageFile = files.find((file) => file.type.startsWith('image/'));
      if (imageFile) {
        // Store original file name for download purposes
        setOriginalFileName(imageFile.name);
        processFile(imageFile);
      }
    },
    [processFile]
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 10));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(initialZoom);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > initialZoom) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > initialZoom) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > initialZoom && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > initialZoom && e.touches.length === 1) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);
    setCustomSettings(FILM_PRESETS[presetKey]);
  };

  const handleCustomSettingChange = (
    key: keyof GrainSettings,
    value: GrainSettings[keyof GrainSettings]
  ) => {
    setCustomSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const extractImageData = (imageUrl: string): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      // Validate input parameter with custom assertion
      assert(
        imageUrl && typeof imageUrl === 'string',
        'Image URL must be a non-empty string',
        { imageUrl, type: typeof imageUrl }
      );

      console.log(
        `Extracting image data from URL: ${imageUrl.substring(0, 50)}...`
      );

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = canvasRef.current || document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          assert(
            ctx !== null,
            'Could not get canvas 2D context - browser may not support canvas'
          );

          // Validate image dimensions with custom assertion
          assert(
            img.width > 0 && img.height > 0,
            'Image must have positive dimensions',
            { width: img.width, height: img.height }
          );

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, img.width, img.height);

          // Validate extracted image data with custom assertion
          assertImageData(imageData, 'extracted image data');

          console.log(
            `Successfully extracted image data: ${imageData.width}x${imageData.height}, ${imageData.data.length} bytes`
          );
          resolve(imageData);
        } catch (error) {
          console.error('Error during image data extraction:', error);
          const extractionError =
            error instanceof Error
              ? error
              : new Error('Unknown extraction error');
          reject(extractionError);
        }
      };
      img.onerror = (event) => {
        const eventType =
          typeof event === 'string'
            ? event
            : (event as Event).type || 'unknown';
        const error = new Error(`Failed to load image: ${eventType}`);
        console.error('Image loading error:', error.message, 'URL:', imageUrl);
        reject(error);
      };
      img.src = imageUrl;
    });
  };

  const imageDataToDataUrl = (imageData: ImageData): string => {
    // Validate input parameter with custom assertion
    assertImageData(imageData, 'imageData parameter');

    console.log(
      `Converting image data to data URL: ${imageData.width}x${imageData.height}`
    );

    const canvas = canvasRef.current || document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    assert(
      ctx !== null,
      'Could not get canvas 2D context for image conversion'
    );

    try {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      // Use PNG format to avoid compression artifacts (lossless)
      const dataUrl = canvas.toDataURL('image/png');

      // Validate result with custom assertion
      assert(
        dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:'),
        'Failed to generate valid data URL from image data',
        { dataUrl: dataUrl?.substring(0, 50) + '...', length: dataUrl?.length }
      );

      console.log(
        `Successfully converted to data URL: ${dataUrl.length} characters`
      );
      return dataUrl;
    } catch (error) {
      console.error('Error during image data to data URL conversion:', error);
      throw error instanceof Error
        ? error
        : new Error('Unknown conversion error');
    }
  };

  const handleProcessGrain = async () => {
    // Validate preconditions with custom assertions
    assert(image !== null, 'No image available for processing');
    assert(grainWorkerRef.current !== null, 'Grain worker not available');
    assert(!isProcessing, 'Processing already in progress');
    assertObject(customSettings, 'customSettings');

    console.log('Starting grain processing with settings:', customSettings);

    setIsProcessing(true);
    setProcessingProgress({ progress: 0, stage: 'Starting...' });

    try {
      // Extract image data from the uploaded image
      const imageData = await extractImageData(image);

      // Process with grain algorithm
      const result = await grainWorkerRef.current.processImage(
        imageData,
        customSettings,
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      if (result.success) {
        const processedDataUrl = imageDataToDataUrl(result.imageData);
        setProcessedImage(processedDataUrl);
        setProcessingProgress({ progress: 100, stage: 'Complete!' });
        console.log('Grain processing completed successfully');
      } else {
        console.error('Grain processing failed:', result.error);
        setProcessingProgress({ progress: 0, stage: `Error: ${result.error}` });
      }
    } catch (error) {
      console.error('Error processing image:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during processing';
      setProcessingProgress({ progress: 0, stage: `Error: ${errorMessage}` });
    }

    setIsProcessing(false);
  };

  const handleDownload = () => {
    const imageToDownload = processedImage || image;
    if (imageToDownload) {
      const link = document.createElement('a');
      link.href = imageToDownload;

      // Always use PNG format to preserve grain quality without compression artifacts
      const isProcessed = !!processedImage;
      const baseName = originalFileName
        ? originalFileName.replace(/\.[^/.]+$/, '')
        : isProcessed
          ? 'grain-processed-image'
          : 'original-image';

      const suffix = isProcessed && originalFileName ? '-grain-processed' : '';

      const filename = `${baseName}${suffix}.png`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const displayImage = showOriginal ? image : processedImage || image;

  return (
    <div className="app">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <header className="app-header">
        <h1>Analog Film Grain Simulator</h1>
        <p>Upload an image to add physically plausible analog film grain</p>
        <div className="prototype-notice">
          <p>
            ⚠️ <strong>Prototype:</strong> This is a development prototype for
            testing coding agent workflows. Functionality is incomplete.
          </p>
        </div>
        {import.meta.env.DEV && (
          <div className="dev-debug-link">
            <a
              href="/grain-debug.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              🔧 Debug Visualizer (Dev Mode)
            </a>
            <a
              href="/grain-visualizer.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              👁️ Grain Visualizer (Dev Mode)
            </a>
            <a
              href="/grain-patterns.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              🔬 Grain Patterns Test (Dev Mode)
            </a>
          </div>
        )}
      </header>

      <div className="controls">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />

        <button onClick={handleUploadClick} className="btn btn-primary">
          📁 Upload Image
        </button>

        {image && (
          <>
            <div className="grain-controls">
              <select
                value={selectedPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="preset-select"
                disabled={isProcessing}
              >
                <option value="kodak-100">Kodak 100 (Fine Grain)</option>
                <option value="kodak-400">Kodak 400 (Medium Grain)</option>
                <option value="kodak-800">Kodak 800 (Visible Grain)</option>
                <option value="kodak-1600">Kodak 1600 (Heavy Grain)</option>
                <option value="fuji-100">Fuji 100 (Fine Grain)</option>
                <option value="fuji-400">Fuji 400 (Medium Grain)</option>
                <option value="fuji-800">Fuji 800 (Visible Grain)</option>
                <option value="ilford-100">Ilford 100 (Fine Grain)</option>
                <option value="ilford-400">Ilford 400 (Medium Grain)</option>
                <option value="ilford-800">Ilford 800 (Visible Grain)</option>
              </select>

              <button
                onClick={handleProcessGrain}
                className="btn btn-accent"
                disabled={isProcessing}
              >
                {isProcessing ? '⚙️ Processing...' : '🎬 Add Grain'}
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="btn btn-secondary"
                disabled={isProcessing}
              >
                ⚙️ Advanced
              </button>
            </div>

            <div className="zoom-controls">
              <button onClick={handleZoomOut} className="btn btn-secondary">
                🔍−
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button onClick={handleZoomIn} className="btn btn-secondary">
                🔍+
              </button>
              <button onClick={handleResetZoom} className="btn btn-secondary">
                ⌖ Reset
              </button>
            </div>

            {processedImage && (
              <div className="comparison-controls">
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className={`btn ${showOriginal ? 'btn-accent' : 'btn-secondary'}`}
                  title="Press SPACE or C to toggle"
                >
                  {showOriginal ? '📷 Original' : '🎬 Grain'}
                </button>
                <span className="keyboard-hint">
                  Press SPACE or C to toggle
                </span>
              </div>
            )}

            <button onClick={handleDownload} className="btn btn-success">
              💾 Download{' '}
              {processedImage ? (showOriginal ? 'Original' : 'Grain') : 'Image'}
            </button>
          </>
        )}
      </div>

      {showAdvanced && image && (
        <div className="advanced-controls">
          <h3>Advanced Settings</h3>
          <div className="control-group">
            <label>
              ISO: {customSettings.iso}
              <input
                type="range"
                min="50"
                max="3200"
                step="50"
                value={customSettings.iso}
                onChange={(e) =>
                  handleCustomSettingChange('iso', parseInt(e.target.value))
                }
                disabled={isProcessing}
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              Film Type:
              <select
                value={customSettings.filmType}
                onChange={(e) =>
                  handleCustomSettingChange(
                    'filmType',
                    e.target.value as GrainSettings['filmType']
                  )
                }
                disabled={isProcessing}
              >
                <option value="kodak">Kodak</option>
                <option value="fuji">Fuji</option>
                <option value="ilford">Ilford</option>
              </select>
            </label>
          </div>
          {import.meta.env.DEV && (
            <div className="control-group">
              <label>
                <input
                  type="checkbox"
                  checked={customSettings.debugGrainCenters || false}
                  onChange={(e) =>
                    handleCustomSettingChange(
                      'debugGrainCenters',
                      e.target.checked
                    )
                  }
                  disabled={isProcessing}
                />
                🎯 Debug: Show grain center points
              </label>
            </div>
          )}
        </div>
      )}

      {isProcessing && (
        <div className="processing-indicator">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${processingProgress.progress}%` }}
            ></div>
          </div>
          <p>{processingProgress.stage}</p>
        </div>
      )}

      <div
        className="image-container"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!image ? (
          <div
            className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
            onClick={handleUploadClick}
          >
            <div className="upload-placeholder">
              <div className="upload-icon">📷</div>
              <p>Click here or drag & drop an image</p>
              <small>Supports JPEG, PNG, WebP</small>
            </div>
          </div>
        ) : (
          <div
            ref={imageViewerRef}
            className={`image-viewer ${processedImage ? 'comparison-available' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
          >
            <img
              ref={imageRef}
              src={displayImage || ''}
              alt={
                showOriginal ? 'Original image' : 'Processed image with grain'
              }
              key={showOriginal ? 'original' : 'processed'} // Force re-render for transition
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </div>
        )}
      </div>

      {image && (
        <div className="image-info">
          <p>
            {processedImage
              ? `✨ ${showOriginal ? 'Showing original image' : 'Showing processed image with grain'}. Use the toggle button to compare versions and zoom to inspect grain structure closely.`
              : 'Image loaded. Select a film preset and click "Add Grain" to process.'}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
