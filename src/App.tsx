import { useState, useRef, useCallback } from 'react'
import './App.css'

function App() {
  const [image, setImage] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  const processFile = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImage(e.target?.result as string)
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

  const handleDownload = () => {
    if (image) {
      const link = document.createElement('a')
      link.href = image
      link.download = 'grain-processed-image.jpg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <div className="app">
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

            <button onClick={handleDownload} className="btn btn-success">
              💾 Download
            </button>
          </>
        )}
      </div>

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
            className="image-viewer"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            <img
              ref={imageRef}
              src={image}
              alt="Uploaded image"
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
          <p>Image loaded successfully. Grain processing will be added in the next step.</p>
        </div>
      )}
    </div>
  )
}

export default App
