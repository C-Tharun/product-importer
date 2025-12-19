function ProgressBar({ progress, status }) {
  const getBarColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'processing':
        return 'bg-blue-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ease-out ${getBarColor()}`}
        style={{
          width: `${progress}%`,
          transition: 'width 0.5s ease-out',
        }}
      >
        {status === 'processing' && (
          <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
        )}
      </div>
    </div>
  )
}

export default ProgressBar

