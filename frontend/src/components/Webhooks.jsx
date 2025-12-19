import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

function Webhooks() {
  const [webhooks, setWebhooks] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState(null)
  const [formData, setFormData] = useState({
    url: '',
    event_type: 'product_created',
    enabled: true,
  })
  const [formError, setFormError] = useState(null)
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  
  // Testing state
  const [testingId, setTestingId] = useState(null)
  const [testResult, setTestResult] = useState(null)
  
  // Toast notification
  const [toast, setToast] = useState(null)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const eventTypes = [
    'product_created',
    'product_updated',
    'product_deleted',
    'import_completed',
  ]

  const fetchWebhooks = async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/webhooks')
      const data = await response.json()
      setWebhooks(data || [])
    } catch (err) {
      showToast(err.message || 'Failed to fetch webhooks', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const openCreateModal = () => {
    setEditingWebhook(null)
    setFormData({ url: '', event_type: 'product_created', enabled: true })
    setFormError(null)
    setShowModal(true)
  }

  const openEditModal = (webhook) => {
    setEditingWebhook(webhook)
    setFormData({
      url: webhook.url,
      event_type: webhook.event_type,
      enabled: webhook.enabled,
    })
    setFormError(null)
    setShowModal(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    try {
      if (editingWebhook) {
        // Update existing webhook
        await apiFetch(`/api/webhooks/${editingWebhook.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        showToast('Webhook updated successfully')
      } else {
        // Create new webhook
        await apiFetch('/api/webhooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        showToast('Webhook created successfully')
      }
      
      setShowModal(false)
      fetchWebhooks()
    } catch (err) {
      setFormError(err.message || 'Failed to save webhook')
    }
  }

  const handleDelete = async (webhookId) => {
    setDeleting(true)
    try {
      await apiFetch(`/api/webhooks/${webhookId}`, {
        method: 'DELETE',
      })
      showToast('Webhook deleted successfully')
      setShowDeleteConfirm(null)
      fetchWebhooks()
    } catch (err) {
      showToast(err.message || 'Failed to delete webhook', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggle = async (webhook) => {
    try {
      await apiFetch(`/api/webhooks/${webhook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...webhook,
          enabled: !webhook.enabled,
        }),
      })
      showToast(`Webhook ${!webhook.enabled ? 'enabled' : 'disabled'}`)
      fetchWebhooks()
    } catch (err) {
      showToast(err.message || 'Failed to update webhook', 'error')
    }
  }

  const handleTest = async (webhookId) => {
    setTestingId(webhookId)
    setTestResult(null)
    try {
      const response = await apiFetch(`/api/webhooks/${webhookId}/test`, {
        method: 'POST',
      })
      const data = await response.json()
      setTestResult(data)
      
      // Show toast with status code and response time if available
      if (data.status_code !== undefined && data.status_code !== null) {
        const statusCode = data.status_code
        const responseTime = data.response_time_ms !== undefined && data.response_time_ms !== null
          ? Math.round(data.response_time_ms)
          : null
        
        if (statusCode >= 200 && statusCode < 300) {
          // Success: 2xx status codes
          const message = responseTime !== null
            ? `Webhook responded with ${statusCode} in ${responseTime} ms`
            : `Webhook responded with ${statusCode}`
          showToast(message)
        } else {
          // Non-2xx status codes
          const message = responseTime !== null
            ? `Webhook responded with ${statusCode} in ${responseTime} ms`
            : `Webhook responded with ${statusCode}`
          showToast(message, 'error')
        }
      } else if (data.error_message) {
        // Error case without status code
        showToast(`Webhook test failed: ${data.error_message}`, 'error')
      } else {
        showToast('Webhook test failed: Unknown error', 'error')
      }
    } catch (err) {
      // Check if error is about disabled webhook
      const errorMessage = err.message || 'Failed to test webhook'
      const isDisabledError = errorMessage.includes('disabled') || errorMessage.includes('Enable it before testing')
      
      setTestResult({ success: false, error_message: errorMessage })
      
      if (isDisabledError) {
        // Show warning toast for disabled webhook
        showToast('Webhook is disabled. Enable it before testing.', 'error')
      } else {
        showToast(errorMessage, 'error')
      }
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Webhooks</h1>
            <p className="text-gray-600">Configure webhooks to receive event notifications</p>
          </div>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105 font-medium"
          >
            + Add Webhook
          </button>
        </header>

        {/* Webhooks List */}
        <div className="bg-white rounded-xl shadow-soft overflow-hidden border border-gray-100">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading webhooks...</p>
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No webhooks configured</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-6 hover:bg-blue-50/30 transition-all duration-200 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          webhook.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {webhook.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {webhook.event_type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">URL:</span> {webhook.url}
                      </p>
                      <p className="text-xs text-gray-500">
                        Created: {new Date(webhook.created_at).toLocaleString()}
                      </p>
                      {testResult && testingId === webhook.id && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          {testResult.status_code !== undefined && testResult.status_code !== null ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-600">Status:</span>
                                <span className={`px-2 py-1 text-xs font-semibold rounded ${
                                  testResult.status_code >= 200 && testResult.status_code < 300
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {testResult.status_code}
                                </span>
                              </div>
                              {testResult.response_time_ms !== undefined && testResult.response_time_ms !== null && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600">Response Time:</span>
                                  <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-800">
                                    {Math.round(testResult.response_time_ms)} ms
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-red-600">
                              {testResult.error_message || 'Test failed'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleToggle(webhook)}
                        className={`px-3 py-1 text-sm rounded ${
                          webhook.enabled
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } transition-colors`}
                      >
                        {webhook.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleTest(webhook.id)}
                        disabled={testingId === webhook.id}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        {testingId === webhook.id ? 'Testing...' : 'Test'}
                      </button>
                      <button
                        onClick={() => openEditModal(webhook)}
                        className="px-3 py-1 text-sm text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(webhook.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in border border-gray-200" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-2xl font-bold mb-4">{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</h2>
              
              {formError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  {formError}
                </div>
              )}
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    required
                    placeholder="https://example.com/webhook"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {eventTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">Enabled</span>
                  </label>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingWebhook ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl animate-scale-in border border-gray-200">
              <h2 className="text-xl font-bold mb-4">Delete Webhook</h2>
              <p className="mb-6 text-gray-700">Are you sure you want to delete this webhook? This action cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-2xl z-50 animate-slide-up backdrop-blur-sm ${
            toast.type === 'error' ? 'bg-red-500/95 text-white' : 'bg-green-500/95 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === 'error' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Webhooks

