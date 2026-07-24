import { API_CONFIG } from '@/config'
import type { Architecture } from '@/types'

export interface GenerateArchitectureRequest {
  description: string
  constraints?: {
    maxServices?: number
    excludeServices?: string[]
    region?: string
    budget?: string
  }
}

export interface GenerateArchitectureResponse {
  architecture: Architecture
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

/**
 * AI Architecture Generation Service
 * Communicates with backend AI Engine Lambda to generate AWS architectures
 */
export class ArchitectureGeneratorService {
  private baseUrl: string

  constructor() {
    this.baseUrl = `${API_CONFIG.baseUrl}/api/architectures`
  }

  /**
   * Generate architecture from natural language description
   * Requires authentication token
   */
  async generate(
    data: GenerateArchitectureRequest,
    accessToken: string
  ): Promise<GenerateArchitectureResponse> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(API_CONFIG.timeout),
    })

    await handleApiResponse(response)

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Architecture generation failed',
      }))
      throw new Error(error.message || 'Architecture generation failed')
    }

    return response.json()
  }
}

export const architectureGeneratorService = new ArchitectureGeneratorService()
