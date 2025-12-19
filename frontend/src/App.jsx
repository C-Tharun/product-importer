import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ProgressTracker from './components/ProgressTracker'
import JobList from './components/JobList'

function App() {
  const [currentJobId, setCurrentJobId] = useState(null)
  const [refreshJobs, setRefreshJobs] = useState(0)

  const handleUploadSuccess = (jobId) => {
    setCurrentJobId(jobId)
    setRefreshJobs((prev) => prev + 1)
  }

  const handleJobComplete = () => {
    setCurrentJobId(null)
    setRefreshJobs((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8 text-center animate-fade-in">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Product Importer
          </h1>
          <p className="text-gray-600">
            Upload CSV files to import products in real-time
          </p>
        </header>

        <div className="space-y-6">
          {/* File Upload Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 animate-slide-up">
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              disabled={currentJobId !== null}
            />
          </div>

          {/* Progress Tracker */}
          {currentJobId && (
            <div className="bg-white rounded-lg shadow-lg p-6 animate-slide-up">
              <ProgressTracker
                jobId={currentJobId}
                onComplete={handleJobComplete}
              />
            </div>
          )}

          {/* Recent Jobs List */}
          <div className="bg-white rounded-lg shadow-lg p-6 animate-slide-up">
            <JobList key={refreshJobs} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

