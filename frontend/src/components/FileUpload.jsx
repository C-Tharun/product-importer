import { useState, useRef } from 'react'
import { apiFetch } from '../lib/api'

function FileUpload({ onUploadSuccess, disabled }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (file) => {
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await apiFetch('/api/upload-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      // Use job_id (UUID) if available, fallback to celery_task_id for backward compatibility
      onUploadSuccess(data.job_id || data.celery_task_id)
    } catch (err) {
      // Handle backend validation errors (HTTP 400)
      // apiFetch already extracts and formats error messages from backend
      setError(err.message || 'Failed to upload file')
      // Do NOT call onUploadSuccess - validation failed, no job started
    } finally {
      setIsUploading(false)
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
            <li>Order does not matter</li>
            <li>Case-insensitive (e.g., "SKU" or "sku" both work)</li>
            <li>Extra CSV columns are allowed and ignored</li>
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
          <div className="space-y-2">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Uploading...</p>
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

