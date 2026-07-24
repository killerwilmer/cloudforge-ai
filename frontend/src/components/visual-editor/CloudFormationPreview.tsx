import { cloudFormationService } from '@/services/cloudformation.service'
import type { Architecture } from '@/types'
import { TokenStorage } from '@/utils/token-storage'
import Editor from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import './CloudFormationPreview.css'

interface CloudFormationPreviewProps {
  architecture: Architecture
  onClose: () => void
}

export function CloudFormationPreview({ architecture, onClose }: CloudFormationPreviewProps) {
  const navigate = useNavigate()
  const [template, setTemplate] = useState<string>('')
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<{
    resourceCount: number
    parameterCount: number
    outputCount: number
  } | null>(null)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [deploying, setDeploying] = useState(false)

  useEffect(() => {
    generateTemplate(format)
  }, [format]) // eslint-disable-line react-hooks/exhaustive-deps

  const generateTemplate = async (selectedFormat: 'yaml' | 'json') => {
    setLoading(true)
    setError(null)
    setCopied(false)

    const accessToken = TokenStorage.getIdToken()
    if (!accessToken) {
      setError('Please sign in to generate CloudFormation templates')
      setLoading(false)
      return
    }

    try {
      const result = await cloudFormationService.generateTemplate(
        {
          architecture,
          format: selectedFormat,
        },
        accessToken
      )

      setTemplate(result.template)
      setMetadata(result.metadata)
      setValidationWarnings(result.validationWarnings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate template')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await cloudFormationService.copyToClipboard(template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      alert('Failed to copy to clipboard')
    }
  }

  const handleDownload = () => {
    const filename = `${architecture.metadata.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-template.${format === 'json' ? 'json' : 'yaml'}`
    cloudFormationService.downloadTemplate(template, format, filename)
  }

  const handleFormatChange = (newFormat: 'yaml' | 'json') => {
    setFormat(newFormat)
  }

  const handleDeploy = async () => {
    if (!template) return

    const stackName = `${architecture.metadata.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`
    
    setDeploying(true)
    setError(null)

    try {
      const result = await deploymentService.startDeployment({
        stackName,
        region: 'us-east-1', // Default region, could be made configurable
        template,
        tags: {
          Application: 'CloudForge',
          ManagedBy: 'CloudForgeAI',
        },
      })

      // Navigate to deployment status page
      navigate(`/deployments/${result.deploymentId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start deployment')
      setDeploying(false)
    }
  }

  return (
    <div className="dialog-overlay cloudformation-preview-overlay">
      <div className="dialog-content cloudformation-preview-dialog">
        <div className="dialog-header">
          <h3>CloudFormation Template</h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="cloudformation-toolbar">
          <div className="format-selector">
            <button
              className={`btn-format ${format === 'yaml' ? 'active' : ''}`}
              onClick={() => handleFormatChange('yaml')}
              disabled={loading}
            >
              YAML
            </button>
            <button
              className={`btn-format ${format === 'json' ? 'active' : ''}`}
              onClick={() => handleFormatChange('json')}
              disabled={loading}
            >
              JSON
            </button>
          </div>

          {metadata && (
            <div className="template-stats">
              <span className="stat">
                <strong>{metadata.resourceCount}</strong> Resources
              </span>
              <span className="stat">
                <strong>{metadata.parameterCount}</strong> Parameters
              </span>
              <span className="stat">
                <strong>{metadata.outputCount}</strong> Outputs
              </span>
            </div>
          )}

          <div className="action-buttons">
            <button
              className="btn btn-secondary"
              onClick={handleCopy}
              disabled={loading || !template || deploying}
              title="Copy to clipboard"
            >
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDownload}
              disabled={loading || !template || deploying}
              title="Download template file"
            >
              📥 Download
            </button>
            <button
              className="btn btn-primary"
              onClick={handleDeploy}
              disabled={loading || !template || deploying}
              title="Deploy to AWS"
            >
              {deploying ? '🔄 Deploying...' : '🚀 Deploy to AWS'}
            </button>
          </div>
        </div>

        {validationWarnings.length > 0 && (
          <div className="validation-warnings">
            <h4>⚠️ Warnings</h4>
            <ul>
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="editor-container">
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
              <p>Generating CloudFormation template...</p>
            </div>
          )}

          {error && (
            <div className="error-message">
              <h4>Error</h4>
              <p>{error}</p>
              <button className="btn btn-secondary" onClick={() => generateTemplate(format)}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && template && (
            <Editor
              height="100%"
              language={format === 'json' ? 'json' : 'yaml'}
              value={template}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                folding: true,
                wordWrap: 'on',
              }}
            />
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
