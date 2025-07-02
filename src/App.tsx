import { useState, useRef, useCallback, useEffect } from 'react'
import { GrainWorkerManager, FILM_PRESETS, GrainSettings, GrainProcessingProgress } from './grain-worker-manager'
import './App.css'

function App() {
  const [image, setImage] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState<GrainProcessingProgress>({ progress: 0, stage: '' })
  const [selectedPreset, setSelectedPreset] = useState('kodak-400')
  const [customSettings, setCustomSettings] = useState<GrainSettings>(FILM_PRESETS['kodak-400'])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const grainWorkerRef = useRef<GrainWorkerManager | null>(null)

  // Initialize grain worker
  useEffect(() => {
    grainWorkerRef.current = new GrainWorkerManager()
    
    return () => {
      grainWorkerRef.current?.terminate()
    }
  }, [])

  // Keyboard shortcuts for comparison
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (processedImage && (event.key === ' ' || event.key === 'c')) {
        event.preventDefault()
        setShowOriginal(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [processedImage])

  const processFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
        setProcessedImage(null)
        setZoom(1)
        setPan({ x: 0, y: 0 })
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      processFile(file)
    }
  }, [processFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find(file => file.type.startsWith('image/'))
    
    if (imageFile) {
      processFile(imageFile)
    }
  }, [processFile])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 10))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1))
  }

  const handleResetZoom = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey)
    setCustomSettings(FILM_PRESETS[presetKey])
  }

  const handleCustomSettingChange = (key: keyof GrainSettings, value: any) => {
    setCustomSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const extractImageData = (imageUrl: string): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        resolve(imageData)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = imageUrl
    })
  }

  const imageDataToDataUrl = (imageData: ImageData): string => {
    const canvas = canvasRef.current || document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    canvas.width = imageData.width
    canvas.height = imageData.height
    ctx.putImageData(imageData, 0, 0)
    
    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const handleProcessGrain = async () => {
    if (!image || !grainWorkerRef.current || isProcessing) return

    setIsProcessing(true)
    setProcessingProgress({ progress: 0, stage: 'Starting...' })

    try {
      // Extract image data from the uploaded image
      const imageData = await extractImageData(image)
      
      // Process with grain algorithm
      const result = await grainWorkerRef.current.processImage(
        imageData,
        customSettings,
        (progress) => {
          setProcessingProgress(progress)
        }
      )

      if (result.success) {
        const processedDataUrl = imageDataToDataUrl(result.imageData)
        setProcessedImage(processedDataUrl)
        setProcessingProgress({ progress: 100, stage: 'Complete!' })
      } else {
        console.error('Grain processing failed:', result.error)
        setProcessingProgress({ progress: 0, stage: `Error: ${result.error}` })
      }
    } catch (error) {
      console.error('Error processing image:', error)
      setProcessingProgress({ progress: 0, stage: 'Error occurred during processing' })
    }

    setIsProcessing(false)
  }

  const handleDownload = () => {
    const imageToDownload = processedImage || image
    if (imageToDownload) {
      const link = document.createElement('a')
      link.href = imageToDownload
      link.download = processedImage ? 'grain-processed-image.jpg' : 'original-image.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const displayImage = showOriginal ? image : (processedImage || image)

  return (
    <div className="app">
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <header className="app-header">
        <h1>Analog Film Grain Simulator</h1>
        <p>Upload an image to add physically plausible analog film grain</p>
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
                <span className="keyboard-hint">Press SPACE or C to toggle</span>
              </div>
            )}

            <button onClick={handleDownload} className="btn btn-success">
              💾 Download {processedImage ? (showOriginal ? 'Original' : 'Grain') : 'Image'}
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
                onChange={(e) => handleCustomSettingChange('iso', parseInt(e.target.value))}
                disabled={isProcessing}
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              Grain Intensity: {Math.round(customSettings.grainIntensity * 100)}%
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1"
                value={customSettings.grainIntensity}
                onChange={(e) => handleCustomSettingChange('grainIntensity', parseFloat(e.target.value))}
                disabled={isProcessing}
              />
            </label>
          </div>
          <div className="control-group">
            <label>
              Film Type:
              <select 
                value={customSettings.filmType}
                onChange={(e) => handleCustomSettingChange('filmType', e.target.value)}
                disabled={isProcessing}
              >
                <option value="kodak">Kodak</option>
                <option value="fuji">Fuji</option>
                <option value="ilford">Ilford</option>
              </select>
            </label>
          </div>
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
            className={`image-viewer ${processedImage ? 'comparison-available' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              ref={imageRef}
              src={displayImage || ''}
              alt={showOriginal ? "Original image" : "Processed image with grain"}
              key={showOriginal ? 'original' : 'processed'} // Force re-render for transition
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
                userSelect: 'none',
                pointerEvents: 'none'
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
              : 'Image loaded. Select a film preset and click "Add Grain" to process.'
            }
          </p>
        </div>
      )}
    </div>
  )
}

export default App
