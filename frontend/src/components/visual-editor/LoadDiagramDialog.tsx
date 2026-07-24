import { useEffect, useState } from 'react'
import { diagramService, type DiagramSummary } from '@/services/diagram.service'
import './LoadDiagramDialog.css'

interface LoadDiagramDialogProps {
  onLoad: (diagramId: string, name: string) => Promise<void>
  onCancel: () => void
}

export function LoadDiagramDialog({
  onLoad,
  onCancel,
}: LoadDiagramDialogProps) {
  const [diagrams, setDiagrams] = useState<DiagramSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false)

  useEffect(() => {
    loadDiagrams()
  }, [])

  const loadDiagrams = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await diagramService.listDiagrams()
      setDiagrams(response.diagrams)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Failed to load diagrams')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLoad = async () => {
    if (!selectedId) return

    const diagram = diagrams.find((d) => d.diagramId === selectedId)
    if (!diagram) return

    setIsLoadingDiagram(true)
    setError(null)

    try {
      await onLoad(selectedId, diagram.name)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Failed to load diagram')
      setIsLoadingDiagram(false)
    }
  }

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString()
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog-content load-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <h3>Load Diagram</h3>
          <button
            className="btn-close"
            onClick={onCancel}
            disabled={isLoadingDiagram}
          >
            ×
          </button>
        </div>

        <div className="dialog-body">
          {isLoading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Loading your diagrams...</p>
            </div>
          )}

          {!isLoading && error && (
            <div className="error-message" role="alert">
              {error}
              <button className="btn-link" onClick={loadDiagrams}>
                Try again
              </button>
            </div>
          )}

          {!isLoading && !error && diagrams.length === 0 && (
            <div className="empty-state">
              <p>No saved diagrams found</p>
              <p className="hint">Create and save your first diagram to see it here</p>
            </div>
          )}

          {!isLoading && !error && diagrams.length > 0 && (
            <div className="diagrams-list">
              {diagrams.map((diagram) => (
                <div
                  key={diagram.diagramId}
                  className={`diagram-item ${selectedId === diagram.diagramId ? 'selected' : ''}`}
                  onClick={() => setSelectedId(diagram.diagramId)}
                >
                  <div className="diagram-info">
                    <h4>{diagram.name}</h4>
                    <div className="diagram-meta">
                      <span className="meta-item">
                        v{diagram.latestVersion}
                      </span>
                      {diagram.servicesCount !== undefined && (
                        <span className="meta-item">
                          {diagram.servicesCount} service{diagram.servicesCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      <span className="meta-item">
                        {formatDate(diagram.updatedAt)}
                      </span>
                    </div>
                    {diagram.tags && diagram.tags.length > 0 && (
                      <div className="diagram-tags">
                        {diagram.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="diagram-actions">
                    {selectedId === diagram.diagramId && (
                      <span className="selected-indicator">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isLoadingDiagram}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleLoad}
            disabled={!selectedId || isLoadingDiagram}
          >
            {isLoadingDiagram ? 'Loading...' : 'Load Diagram'}
          </button>
        </div>
      </div>
    </div>
  )
}
