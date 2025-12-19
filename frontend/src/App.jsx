import { useState } from 'react'
import FileUpload from './components/FileUpload'
import ProgressTracker from './components/ProgressTracker'
import JobList from './components/JobList'
import Products from './components/Products'
import Webhooks from './components/Webhooks'
import Footer from './components/Footer'

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-100 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-sm shadow-md sticky top-0 z-50 border-b border-gray-200/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Product Importer
              </h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage('import')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'import'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  Import
                </button>
                <button
                  onClick={() => setCurrentPage('products')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'products'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  Products
                </button>
                <button
                  onClick={() => setCurrentPage('webhooks')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === 'webhooks'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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
      <div className="container mx-auto px-4 py-8 max-w-6xl flex-1">
        {currentPage === 'import' && (
          <header className="mb-8 text-center animate-fade-in">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              CSV Import
            </h2>
            <p className="text-gray-600 text-lg">
              Upload CSV files to import products in real-time
            </p>
          </header>
        )}
        <div className="animate-fade-in">
          {renderPage()}
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App

