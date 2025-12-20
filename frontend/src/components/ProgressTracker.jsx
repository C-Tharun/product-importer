import { useState, useEffect } from 'react'
import { useJobEvents } from '../hooks/useJobEvents'
import ProgressBar from './ProgressBar'

function ProgressTracker({ jobId, onComplete }) {
  const { status, progress, totalRows, processedRows, errorMessage } =
    useJobEvents(jobId)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    // Update status text based on job status with more detailed messages
    switch (status) {
      case 'pending':
        setStatusText('Queued for processing...')
        break
      case 'processing':
        if (!totalRows) {
          setStatusText('Parsing CSV file...')
        } else if (processedRows === 0) {
          setStatusText('Validating and starting import...')
        } else {
          setStatusText(`Processing ${processedRows || 0} of ${totalRows} rows...`)
        }
        break
      case 'completed':
        setStatusText('Import Complete')
        break
      case 'failed':
        setStatusText('Import Failed')
        break
      default:
        setStatusText('Initializing...')
    }
  }, [status, totalRows, processedRows])

  useEffect(() => {
    // Call onComplete when job finishes
    if (status === 'completed' || status === 'failed') {
      const timer = setTimeout(() => {
        onComplete()
      }, 3000) // Wait 3 seconds before hiding
      return () => clearTimeout(timer)
    }
  }, [status, onComplete])

  if (!status) {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Connecting...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-semibold text-gray-800 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Import Progress</h2>

      <div className="space-y-3">
        {/* Status Message */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            {statusText}
          </span>
          <span className={`text-sm font-bold px-2 py-1 rounded ${
            status === 'completed' 
              ? 'bg-green-100 text-green-800' 
              : status === 'failed'
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {progress}%
          </span>
        </div>

        {/* Progress Bar */}
        <ProgressBar progress={progress} status={status} />

        {/* Row Count */}
        {totalRows && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{processedRows || 0} / {totalRows} rows processed</span>
            {status === 'processing' && processedRows > 0 && totalRows > 0 && (
              <span className="text-gray-400">
                {Math.round(((totalRows - (processedRows || 0)) / totalRows) * 100)}% remaining
              </span>
            )}
          </div>
        )}
      </div>

      {status === 'failed' && errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
          <p className="text-red-800 font-medium mb-1">Error:</p>
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      {status === 'completed' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
          <p className="text-green-800 font-medium">
            ✓ All products imported successfully!
          </p>
        </div>
      )}
    </div>
  )
}

export default ProgressTracker

