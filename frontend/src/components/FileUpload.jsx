import { useState, useRef } from 'react'
import { apiFetch, getApiUrl } from '../lib/api'

function FileUpload({ onUploadSuccess, disabled }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadEstimatedTimeRemaining, setUploadEstimatedTimeRemaining] = useState(null)
  const [isLargeFile, setIsLargeFile] = useState(false)
  const [fileSize, setFileSize] = useState(0)
  const fileInputRef = useRef(null)
  const uploadStartTimeRef = useRef(null)
  const uploadSpeedRef = useRef(null)

  const formatTime = (seconds) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.round(seconds % 60)
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const handleFileSelect = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    // Check if file is large (10MB threshold)
    const fileSizeBytes = file.size
    const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB
    const isLarge = fileSizeBytes > LARGE_FILE_THRESHOLD
    setIsLargeFile(isLarge)
    setFileSize(fileSizeBytes)

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)
    setUploadEstimatedTimeRemaining(null)
    uploadStartTimeRef.current = Date.now()
    uploadSpeedRef.current = null

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Use XMLHttpRequest for upload progress tracking
      const xhr = new XMLHttpRequest()
      const url = getApiUrl('/api/upload-csv')

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100
          setUploadProgress(progress)

          // Calculate upload speed and estimated time remaining
          const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000 // seconds
          if (elapsed > 0.5) { // Wait at least 0.5s for accurate speed calculation
            const speed = e.loaded / elapsed // bytes per second
            uploadSpeedRef.current = speed

            const remaining = e.total - e.loaded
            const estimatedTimeRemaining = remaining / speed // seconds
            setUploadEstimatedTimeRemaining(estimatedTimeRemaining > 0 ? estimatedTimeRemaining : null)
          }
        }
      })

      // Handle response
      const response = await new Promise((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText)
              resolve({ ok: true, json: () => Promise.resolve(data) })
            } catch (err) {
              reject(new Error('Failed to parse response'))
            }
          } else {
            // Handle error response
            let errorMessage = `Request failed with status ${xhr.status}`
            try {
              const errorData = JSON.parse(xhr.responseText)
              if (errorData.detail) {
                if (typeof errorData.detail === 'string') {
                  errorMessage = errorData.detail
                } else if (typeof errorData.detail === 'object') {
                  if (errorData.detail.message) {
                    errorMessage = errorData.detail.message
                  } else if (errorData.detail.error) {
                    errorMessage = errorData.detail.error
                    if (errorData.detail.required_headers) {
                      errorMessage += `. Required headers: ${errorData.detail.required_headers.join(', ')}.`
                    }
                  } else {
                    errorMessage = JSON.stringify(errorData.detail)
                  }
                }
              } else if (errorData.message) {
                errorMessage = errorData.message
              }
            } catch {
              errorMessage = xhr.statusText || errorMessage
            }
            reject(new Error(errorMessage))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was cancelled'))
        })

        xhr.open('POST', url)
        xhr.send(formData)
      })

      const data = await response.json()
      // Use job_id (UUID) if available, fallback to celery_task_id for backward compatibility
      onUploadSuccess(data.job_id || data.celery_task_id)
    } catch (err) {
      // Handle backend validation errors (HTTP 400)
      setError(err.message || 'Failed to upload file')
      // Do NOT call onUploadSuccess - validation failed, no job started
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
      setUploadEstimatedTimeRemaining(null)
      setFileSize(0)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled) return

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Upload CSV File
      </h2>

      {/* Expected CSV Format Section */}
      <div className="mb-6 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Expected CSV Format</h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">Required headers:</span>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-white rounded border border-gray-300 font-mono text-xs">sku</span>
              <span className="text-gray-400">|</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-300 font-mono text-xs">name</span>
              <span className="text-gray-400">|</span>
              <span className="px-2 py-1 bg-white rounded border border-gray-300 font-mono text-xs">description</span>
            </div>
          </div>
          <ul className="list-disc list-inside text-xs text-gray-500 space-y-0.5 ml-2">
            <li>Headers are required</li>
            <li>Coloumn order does not matter</li>
            <li>Case-insensitive (e.g., "SKU" or "sku" both work)</li>
            <li>Additional CSV columns are allowed and ignored</li>
          </ul>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20 scale-[1.02]'
              : disabled
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed opacity-60'
              : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md hover:scale-[1.01]'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            {isLargeFile && (
              <div className="space-y-1">
                <p className="text-gray-700 font-medium">
                  Larger files take a while to upload, please wait...
                </p>
                <p className="text-sm text-gray-500">
                  Uploading {formatFileSize(fileSize)}
                </p>
              </div>
            )}
            {!isLargeFile && (
              <p className="text-gray-600">Uploading...</p>
            )}
            {/* Upload Progress Bar */}
            <div className="w-full max-w-xs mx-auto">
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                <span>{Math.round(uploadProgress)}%</span>
                {uploadEstimatedTimeRemaining !== null && uploadEstimatedTimeRemaining > 0 && (
                  <span className="text-blue-600 font-medium">
                    Estimated time remaining: {formatTime(uploadEstimatedTimeRemaining)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : disabled ? (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-gray-600">Processing in progress...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-gray-700 font-medium">
              Drag and drop a CSV file here, or click to select
            </p>
            <p className="text-sm text-gray-500">CSV files only</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  )
}

export default FileUpload

