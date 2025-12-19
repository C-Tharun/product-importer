import { useState, useEffect } from 'react'
import { apiFetch, getApiUrl } from '../lib/api'

/**
 * Custom hook to listen to Server-Sent Events for job progress updates.
 * Uses EventSource API for real-time updates.
 */
export function useJobEvents(jobId) {
  const [status, setStatus] = useState(null)
  const [progress, setProgress] = useState(0)
  const [totalRows, setTotalRows] = useState(null)
  const [processedRows, setProcessedRows] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    if (!jobId) return

    // Create EventSource connection to SSE endpoint
    const eventSource = new EventSource(getApiUrl(`/api/jobs/${jobId}/events`))

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.status) setStatus(data.status)
        if (data.progress !== undefined) setProgress(data.progress)
        if (data.total_rows !== undefined) setTotalRows(data.total_rows)
        if (data.processed_rows !== undefined)
          setProcessedRows(data.processed_rows)
        if (data.error_message !== undefined)
          setErrorMessage(data.error_message)

        // Close connection when job is complete
        if (data.status === 'completed' || data.status === 'failed') {
          eventSource.close()
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err)
      // Try to fetch current status as fallback
      apiFetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status) setStatus(data.status)
          if (data.progress !== undefined) setProgress(data.progress)
          if (data.total_rows !== undefined) setTotalRows(data.total_rows)
          if (data.processed_rows !== undefined)
            setProcessedRows(data.processed_rows)
          if (data.error_message !== undefined)
            setErrorMessage(data.error_message)
        })
        .catch(console.error)
      eventSource.close()
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }, [jobId])

  return {
    status,
    progress,
    totalRows,
    processedRows,
    errorMessage,
  }
}

