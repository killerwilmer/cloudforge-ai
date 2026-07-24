import { TokenStorage } from './token-storage'

/**
 * API response interceptor
 * Automatically handles 401 responses by clearing tokens and redirecting
 */
export async function handleApiResponse(response: Response): Promise<Response> {
  // If unauthorized, clear tokens and reload to trigger redirect
  if (response.status === 401) {
    console.warn('Session expired (401). Clearing tokens and redirecting to login.')
    TokenStorage.clearTokens()
    
    // Redirect to auth page
    window.location.href = '/auth'
  }

  return response
}

/**
 * Wrapper for fetch that includes automatic 401 handling
 */
export async function fetchWithAuth(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const response = await fetch(url, options)
  return handleApiResponse(response)
}
