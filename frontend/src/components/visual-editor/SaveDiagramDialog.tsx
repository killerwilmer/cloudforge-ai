import { useState } from 'react'
import './SaveDiagramDialog.css'

interface SaveDiagramDialogProps {
  currentName?: string
  onSave: (name: string, changeDescription?: string) => Promise<void>
  onCancel: () => void
}

export function SaveDiagramDialog({
  currentName,
  onSave,
  onCancel,
}: SaveDiagramDialogProps) {
  const [name, setName] = useState(currentName || '')
  const [changeDescription, setChangeDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Diagram name is required')
      return
    }

    if (name.length > 100) {
      setError('Diagram name must be 100 characters or less')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(name.trim(), changeDescription.trim() || undefined)
    } catch (err) {
      const error = err as Error
      setError(error.message || 'Failed to save diagram')
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{currentName ? 'Save Changes' : 'Save Diagram'}</h3>
          <button className="btn-close" onClick={onCancel} disabled={isSaving}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label htmlFor="diagram-name">
              Diagram Name <span className="required">*</span>
            </label>
            <input
              id="diagram-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="My Architecture"
              maxLength={100}
              disabled={isSaving}
              autoFocus
            />
            <span className="character-count">
              {name.length} / 100
            </span>
          </div>

          {currentName && (
            <div className="form-group">
              <label htmlFor="change-description">
                Change Description (optional)
              </label>
              <textarea
                id="change-description"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What changed in this version?"
                rows={3}
                maxLength={500}
                disabled={isSaving}
              />
              <span className="character-count">
                {changeDescription.length} / 500
              </span>
            </div>
          )}

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Saving...' : currentName ? 'Save Changes' : 'Save Diagram'}
          </button>
        </div>
      </div>
    </div>
  )
}
