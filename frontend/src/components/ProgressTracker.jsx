import { useState, useEffect } from 'react'
import { useJobEvents } from '../hooks/useJobEvents'
import ProgressBar from './ProgressBar'

function ProgressTracker({ jobId, onComplete }) {
  const { status, progress, totalRows, processedRows, errorMessage } =
    useJobEvents(jobId)
  const [statusText, setStatusText] = useState('')

  useEffect(() => {
    // Update status text based on job status
    switch (status) {
      case 'pending':
        setStatusText('Queued for processing...')
        break
      case 'processing':
        setStatusText(
          totalRows
            ? `Processing ${processedRows || 0} of ${totalRows} rows...`
            : 'Parsing CSV file...'
        )
        break
      case 'completed':
        setStatusText('Import completed successfully!')
        break
      case 'failed':
        setStatusText('Import failed')
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
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-800">Import Progress</h2>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">
            {statusText}
          </span>
          <span className="text-sm font-bold text-blue-600">{progress}%</span>
        </div>

        <ProgressBar progress={progress} status={status} />

        {totalRows && (
          <p className="text-xs text-gray-500 text-right">
            {processedRows || 0} / {totalRows} rows processed
          </p>
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

