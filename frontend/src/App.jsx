import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ProgressTracker from './components/ProgressTracker'
import JobList from './components/JobList'
import Products from './components/Products'
import Webhooks from './components/Webhooks'

function App() {
  const [currentPage, setCurrentPage] = useState('import') // 'import', 'products', 'webhooks'
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

  const renderPage = () => {
    switch (currentPage) {
      case 'products':
        return <Products />
      case 'webhooks':
        return <Webhooks />
      case 'import':
      default:
        return (
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
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">Product Importer</h1>
              <div className="flex space-x-4">
                <button
                  onClick={() => setCurrentPage('import')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'import'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Import
                </button>
                <button
                  onClick={() => setCurrentPage('products')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'products'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Products
                </button>
                <button
                  onClick={() => setCurrentPage('webhooks')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === 'webhooks'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Webhooks
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {currentPage === 'import' && (
          <header className="mb-8 text-center animate-fade-in">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              CSV Import
            </h2>
            <p className="text-gray-600">
              Upload CSV files to import products in real-time
            </p>
          </header>
        )}
        {renderPage()}
      </div>
    </div>
  )
}

export default App

