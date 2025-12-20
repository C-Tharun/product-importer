import { useState, useEffect, useRef } from 'react'
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
  const [etaSeconds, setEtaSeconds] = useState(null)
  
  // Use ref to track current status for stuck check (avoids closure issues)
  const statusRef = useRef(null)
  statusRef.current = status

  useEffect(() => {
    if (!jobId) return

    let pollInterval = null
    let lastUpdateTime = Date.now()
    
    // Create EventSource connection to SSE endpoint
    const eventSource = new EventSource(getApiUrl(`/api/jobs/${jobId}/events`))
    
    // Polling fallback: if SSE doesn't update for 5 seconds, start polling
    const startPolling = () => {
      if (pollInterval) return
      pollInterval = setInterval(async () => {
        try {
          const res = await apiFetch(`/api/jobs/${jobId}`)
          const data = await res.json()
          
          // Update state with latest data
          if (data.status) setStatus(data.status)
          if (data.progress !== undefined) setProgress(data.progress)
          if (data.total_rows !== undefined) setTotalRows(data.total_rows)
          if (data.processed_rows !== undefined) setProcessedRows(data.processed_rows)
          if (data.error_message !== undefined) setErrorMessage(data.error_message)
          if (data.eta_seconds !== undefined) setEtaSeconds(data.eta_seconds)
          
          lastUpdateTime = Date.now()
          
          // Stop polling if job is complete
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = null
            }
            eventSource.close()
          }
        } catch (err) {
          console.error('Polling error:', err)
        }
      }, 2000) // Poll every 2 seconds as fallback
    }

    // Check if SSE is stuck (no updates for 5 seconds while processing)
    const stuckCheckInterval = setInterval(() => {
      const timeSinceUpdate = Date.now() - lastUpdateTime
      if (statusRef.current === 'processing' && timeSinceUpdate > 5000 && !pollInterval) {
        console.log('SSE appears stuck, starting polling fallback')
        startPolling()
      }
    }, 3000)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.status) setStatus(data.status)
        if (data.progress !== undefined) setProgress(data.progress)
        if (data.total_rows !== undefined) setTotalRows(data.total_rows)
        if (data.processed_rows !== undefined) setProcessedRows(data.processed_rows)
        if (data.error_message !== undefined) setErrorMessage(data.error_message)
        if (data.eta_seconds !== undefined) setEtaSeconds(data.eta_seconds)
        
        lastUpdateTime = Date.now()

        // Close connection when job is complete
        if (data.status === 'completed' || data.status === 'failed') {
          if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
          }
          clearInterval(stuckCheckInterval)
          eventSource.close()
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    }

    eventSource.onerror = (err) => {
      console.error('SSE connection error:', err)
      // Start polling as fallback
      startPolling()
      // Try to fetch current status immediately
      apiFetch(`/api/jobs/${jobId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status) setStatus(data.status)
          if (data.progress !== undefined) setProgress(data.progress)
          if (data.total_rows !== undefined) setTotalRows(data.total_rows)
          if (data.processed_rows !== undefined) setProcessedRows(data.processed_rows)
          if (data.error_message !== undefined) setErrorMessage(data.error_message)
          if (data.eta_seconds !== undefined) setEtaSeconds(data.eta_seconds)
          lastUpdateTime = Date.now()
        })
        .catch(console.error)
    }

    // Cleanup on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
      clearInterval(stuckCheckInterval)
      eventSource.close()
    }
  }, [jobId])

  return {
    status,
    progress,
    totalRows,
    processedRows,
    errorMessage,
    etaSeconds,
  }
}

