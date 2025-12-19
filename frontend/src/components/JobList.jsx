import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

function JobList() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchJobs = async () => {
    try {
      const response = await apiFetch('/api/jobs?limit=10')
      const data = await response.json()
      setJobs(data.jobs || [])
    } catch (err) {
      console.error('Failed to fetch jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    // Refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading jobs...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Recent Imports
      </h2>

      {jobs.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No imports yet</p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.job_id}
              className="border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-200 transition-all duration-300 animate-fade-in bg-white"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                      job.status
                    )}`}
                  >
                    {job.status}
                  </span>
                  <span className="text-sm text-gray-600">
                    {job.file_name || 'Unknown file'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(job.created_at)}
                </span>
              </div>

              {job.status === 'processing' && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{job.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    ></div>
                  </div>
                  {job.total_rows && (
                    <p className="text-xs text-gray-500 mt-1">
                      {job.processed_rows || 0} / {job.total_rows} rows
                    </p>
                  )}
                </div>
              )}

              {job.status === 'completed' && job.total_rows && (
                <p className="text-xs text-gray-600 mt-2">
                  ✓ {job.total_rows} rows imported
                </p>
              )}

              {job.status === 'failed' && job.error_message && (
                <p className="text-xs text-red-600 mt-2">
                  ✗ {job.error_message}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default JobList

