import type { Architecture } from '@/types'
import { TokenStorage } from '@/utils/token-storage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.cloudforge.ai'

export interface SaveDiagramRequest {
  diagramId?: string
  name: string
  architecture: Architecture
  changeDescription?: string
  tags?: string[]
}

export interface SaveDiagramResponse {
  diagramId: string
  version: number
  name: string
  s3Key: string
  createdAt: string
  message: string
}

export interface DiagramSummary {
  diagramId: string
  name: string
  latestVersion: number
  tags: string[]
  updatedAt: string
  servicesCount?: number
  connectionsCount?: number
}

export interface ListDiagramsResponse {
  diagrams: DiagramSummary[]
  count: number
  lastKey?: string
}

export interface GetDiagramResponse {
  diagramId: string
  version: number
  name: string
  architecture: Architecture
  tags: string[]
  createdAt: string
  updatedAt: string
  changeDescription?: string
}

export interface DeleteDiagramResponse {
  message: string
  diagramId: string
  versionsDeleted: number
}

class DiagramService {
  /**
   * Save diagram (create new or update existing)
   */
  async saveDiagram(
    request: SaveDiagramRequest,
    accessToken: string
  ): Promise<SaveDiagramResponse> {
    const response = await fetch(`${API_BASE_URL}/api/diagrams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to save diagram',
      }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get diagram by ID
   */
  async getDiagram(
    diagramId: string,
    version?: number,
    accessToken?: string
  ): Promise<GetDiagramResponse> {
    const token = accessToken || TokenStorage.getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const versionParam = version ? `?version=${version}` : ''
    const response = await fetch(
      `${API_BASE_URL}/api/diagrams/${diagramId}${versionParam}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to load diagram',
      }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * List all diagrams for current user
   */
  async listDiagrams(
    limit = 50,
    lastKey?: string,
    accessToken?: string
  ): Promise<ListDiagramsResponse> {
    const token = accessToken || TokenStorage.getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const params = new URLSearchParams()
    params.append('limit', limit.toString())
    if (lastKey) {
      params.append('lastKey', lastKey)
    }

    const response = await fetch(
      `${API_BASE_URL}/api/diagrams?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to list diagrams',
      }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Delete diagram
   */
  async deleteDiagram(
    diagramId: string,
    accessToken?: string
  ): Promise<DeleteDiagramResponse> {
    const token = accessToken || TokenStorage.getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch(`${API_BASE_URL}/api/diagrams/${diagramId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Failed to delete diagram',
      }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  /**
   * Auto-save to localStorage
   */
  saveToLocalStorage(architecture: Architecture, name?: string): void {
    try {
      const data = {
        architecture,
        name: name || 'Untitled Architecture',
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('cloudforge_autosave', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to auto-save to localStorage:', error)
    }
  }

  /**
   * Load from localStorage
   */
  loadFromLocalStorage(): {
    architecture: Architecture
    name: string
    timestamp: string
  } | null {
    try {
      const data = localStorage.getItem('cloudforge_autosave')
      if (!data) return null
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }

  /**
   * Clear localStorage auto-save
   */
  clearLocalStorage(): void {
    try {
      localStorage.removeItem('cloudforge_autosave')
    } catch (error) {
      console.error('Failed to clear localStorage:', error)
    }
  }
}

export const diagramService = new DiagramService()
