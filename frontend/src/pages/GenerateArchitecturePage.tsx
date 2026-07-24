import { architectureGeneratorService } from '@/services/ai-engine/architecture-generator.service'
import type { Architecture } from '@/types'
import { TokenStorage } from '@/utils/token-storage'
import { useState } from 'react'
import './GenerateArchitecturePage.css'

const MAX_DESCRIPTION_LENGTH = 2000
const MIN_DESCRIPTION_LENGTH = 20

interface GenerateArchitecturePageProps {
  onArchitectureGenerated?: (architecture: Architecture) => void
}

export function GenerateArchitecturePage({
  onArchitectureGenerated,
}: GenerateArchitecturePageProps) {
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedArchitecture, setGeneratedArchitecture] =
    useState<Architecture | null>(null)
  const [tokenUsage, setTokenUsage] = useState<{
    inputTokens: number
    outputTokens: number
    totalTokens: number
  } | null>(null)

  // Get ID token from TokenStorage (Cognito authorizer uses ID token, not access token)
  const getAccessToken = (): string | null => {
    return TokenStorage.getIdToken()
  }

  const handleGenerate = async () => {
    // Validation
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setError(
        `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`
      )
      return
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      setError(
        `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters`
      )
      return
    }

    const accessToken = getAccessToken()
    if (!accessToken) {
      setError('Please sign in to generate architectures')
      return
    }

    setError(null)
    setIsGenerating(true)
    setGeneratedArchitecture(null)
    setTokenUsage(null)

    try {
      const response = await architectureGeneratorService.generate(
        { description: description.trim() },
        accessToken
      )

      setGeneratedArchitecture(response.architecture)
      setTokenUsage(response.usage)

      // Notify parent component if callback provided
      if (onArchitectureGenerated) {
        onArchitectureGenerated(response.architecture)
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to generate architecture'
      setError(errorMessage)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClear = () => {
    setDescription('')
    setError(null)
    setGeneratedArchitecture(null)
    setTokenUsage(null)
  }

  const characterCount = description.length
  const characterCountClass =
    characterCount > MAX_DESCRIPTION_LENGTH
      ? 'error'
      : characterCount > MAX_DESCRIPTION_LENGTH * 0.9
        ? 'warning'
        : ''

  return (
    <div className="generate-architecture-page">
      <header className="page-header">
        <h1>Generate AWS Architecture</h1>
        <p>Describe your problem and let AI design the AWS solution</p>
      </header>

      <div className="generation-container">
        <div className="input-section">
          <label htmlFor="description" className="input-label">
            Problem Description
            <span className="required">*</span>
          </label>
          <textarea
            id="description"
            className="description-input"
            placeholder="Example: I need a serverless REST API to manage user tasks. Users should be able to create, read, update, and delete tasks. The API needs authentication and should store data persistently..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isGenerating}
            rows={8}
          />
          <div className="input-footer">
            <span className={`character-count ${characterCountClass}`}>
              {characterCount} / {MAX_DESCRIPTION_LENGTH}
            </span>
            {characterCount < MIN_DESCRIPTION_LENGTH && characterCount > 0 && (
              <span className="hint">
                (minimum {MIN_DESCRIPTION_LENGTH} characters)
              </span>
            )}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                description.trim().length < MIN_DESCRIPTION_LENGTH ||
                description.length > MAX_DESCRIPTION_LENGTH
              }
            >
              {isGenerating ? (
                <>
                  <span className="spinner" />
                  Generating...
                </>
              ) : (
                'Generate Architecture'
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={isGenerating}
            >
              Clear
            </button>
          </div>

          {error && (
            <div className="error-message" role="alert">
              <svg className="icon" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}
        </div>

        {(isGenerating || generatedArchitecture) && (
          <div className="results-section">
            <h2>Generated Architecture</h2>

            {isGenerating && (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>AI is analyzing your requirements and designing the architecture...</p>
                <p className="loading-hint">This may take up to 30 seconds</p>
              </div>
            )}

            {generatedArchitecture && (
              <div className="architecture-result">
                <div className="architecture-header">
                  <h3>{generatedArchitecture.metadata.name}</h3>
                  {generatedArchitecture.metadata.description && (
                    <p className="architecture-description">
                      {generatedArchitecture.metadata.description}
                    </p>
                  )}
                </div>

                <div className="architecture-stats">
                  <div className="stat">
                    <span className="stat-label">Services</span>
                    <span className="stat-value">
                      {generatedArchitecture.services.length}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Connections</span>
                    <span className="stat-value">
                      {generatedArchitecture.connections.length}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Region</span>
                    <span className="stat-value">
                      {generatedArchitecture.metadata.region || 'us-east-1'}
                    </span>
                  </div>
                </div>

                <div className="services-list">
                  <h4>AWS Services</h4>
                  <ul>
                    {generatedArchitecture.services.map((service) => (
                      <li key={service.id} className="service-item">
                        <span className="service-type">{service.type}</span>
                        <span className="service-name">{service.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {tokenUsage && (
                  <div className="token-usage">
                    <span className="usage-label">AI Usage:</span>
                    <span className="usage-value">
                      {tokenUsage.totalTokens.toLocaleString()} tokens
                    </span>
                    <span className="usage-detail">
                      ({tokenUsage.inputTokens} in / {tokenUsage.outputTokens}{' '}
                      out)
                    </span>
                  </div>
                )}

                <div className="next-actions">
                  <button type="button" className="btn btn-primary">
                    Open in Visual Editor
                  </button>
                  <button type="button" className="btn btn-secondary">
                    Generate CloudFormation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
