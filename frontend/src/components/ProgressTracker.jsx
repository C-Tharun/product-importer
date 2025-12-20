import { useState, useEffect } from 'react'
import { useJobEvents } from '../hooks/useJobEvents'
import { apiFetch } from '../lib/api'
import ProgressBar from './ProgressBar'

function ProgressTracker({ jobId, onComplete, onCancel }) {
  const { status, progress, totalRows, processedRows, errorMessage, estimatedTimeRemainingSeconds } =
    useJobEvents(jobId)
  const [statusText, setStatusText] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)

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

  const formatTime = (seconds) => {
    if (!seconds || seconds < 0) return null
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    }
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await apiFetch(`/api/jobs/${jobId}/cancel`, {
        method: 'PUT',
      })
      setShowCancelConfirm(false)
      if (onCancel) {
        onCancel()
      }
    } catch (err) {
      console.error('Failed to cancel job:', err)
      alert(err.message || 'Failed to cancel job')
    } finally {
      setCancelling(false)
    }
  }

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

        {/* Row Count and Estimated Time Remaining */}
        {totalRows && (
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{processedRows || 0} / {totalRows} rows processed</span>
            <div className="flex items-center gap-3">
              {status === 'processing' && processedRows > 0 && totalRows > 0 && (
                <span className="text-gray-400">
                  {Math.round(((totalRows - (processedRows || 0)) / totalRows) * 100)}% remaining
                </span>
              )}
              {status === 'processing' && estimatedTimeRemainingSeconds !== null && estimatedTimeRemainingSeconds !== undefined && (
                <span className="text-blue-600 font-medium">
                  Estimated time remaining: {formatTime(estimatedTimeRemainingSeconds)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cancel Button */}
      {(status === 'processing' || status === 'pending') && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Cancel Import
          </button>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in border border-red-200">
            <h2 className="text-xl font-bold mb-4 text-red-600">Cancel Import</h2>
            <p className="mb-6 text-gray-700">
              Are you sure you want to cancel this import? This will stop processing immediately and any remaining rows will not be imported. This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelling}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                No, Continue
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel Import'}
              </button>
            </div>
          </div>
        </div>
      )}

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

