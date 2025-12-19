/**
 * API helper for making requests to the backend.
 * Uses VITE_API_BASE_URL from environment variables.
 * Falls back to empty string for local dev (Vite proxy handles it).
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Fetches from the API with the base URL prefixed.
 * @param {string} path - API path (e.g., '/api/jobs')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 * @throws {Error} If response is not OK
 */
export async function apiFetch(path, options = {}) {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE_URL}${normalizedPath}`

  const response = await fetch(url, options)

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorData.message || errorMessage
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage
    }
    throw new Error(errorMessage)
  }

  return response
}

/**
 * Gets the full API URL for a given path.
 * Useful for EventSource which doesn't use fetch.
 * @param {string} path - API path
 * @returns {string} Full URL
 */
export function getApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

