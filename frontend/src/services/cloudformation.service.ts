import type { Architecture } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.cloudforge.ai'

export interface GenerateCloudFormationRequest {
  architecture: Architecture
  format?: 'yaml' | 'json'
}

export interface GenerateCloudFormationResponse {
  template: string
  format: 'yaml' | 'json'
  metadata: {
    resourceCount: number
    parameterCount: number
    outputCount: number
  }
  validationWarnings?: string[]
}

/**
 * CloudFormation Service
 * Handles CloudFormation template generation API calls
 */
class CloudFormationService {
  /**
   * Generate CloudFormation template from architecture
   */
  async generateTemplate(
    request: GenerateCloudFormationRequest,
    accessToken: string
  ): Promise<GenerateCloudFormationResponse> {
    const response = await fetch(`${API_BASE_URL}/api/cloudformation/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Failed to generate CloudFormation template: ${response.statusText}`
      )
    }

    const data = await response.json()
    return data
  }

  /**
   * Download CloudFormation template as file
   */
  downloadTemplate(template: string, format: 'yaml' | 'json', filename?: string): void {
    const blob = new Blob([template], {
      type: format === 'json' ? 'application/json' : 'text/yaml',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || `cloudformation-template.${format === 'json' ? 'json' : 'yaml'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Copy template to clipboard
   */
  async copyToClipboard(template: string): Promise<void> {
    await navigator.clipboard.writeText(template)
  }
}

export const cloudFormationService = new CloudFormationService()
