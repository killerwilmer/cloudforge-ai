import type { Node } from 'reactflow'
import './ServiceConfigForm.css'

interface ServiceConfigFormProps {
  node: Node
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void
  onNameChange: (nodeId: string, name: string) => void
}

export function ServiceConfigForm({ node, onConfigChange, onNameChange }: ServiceConfigFormProps) {
  const serviceType = node.data.serviceType as string
  const config = (node.data.configuration || {}) as Record<string, unknown>

  const updateConfig = (key: string, value: unknown) => {
    onConfigChange(node.id, { ...config, [key]: value })
  }

  // Render service-specific configuration fields
  const renderServiceConfig = () => {
    switch (serviceType) {
      case 'Lambda':
        return (
          <>
            <div className="form-group">
              <label>Memory (MB)</label>
              <select
                value={(config.memory as string) || '128'}
                onChange={(e) => updateConfig('memory', e.target.value)}
              >
                <option value="128">128 MB</option>
                <option value="256">256 MB</option>
                <option value="512">512 MB</option>
                <option value="1024">1024 MB (1 GB)</option>
                <option value="2048">2048 MB (2 GB)</option>
                <option value="3072">3072 MB (3 GB)</option>
                <option value="4096">4096 MB (4 GB)</option>
                <option value="10240">10240 MB (10 GB)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Timeout (seconds)</label>
              <input
                type="number"
                min="1"
                max="900"
                value={(config.timeout as number) || 30}
                onChange={(e) => updateConfig('timeout', parseInt(e.target.value))}
              />
              <span className="form-hint">Max: 900 seconds (15 minutes)</span>
            </div>
            <div className="form-group">
              <label>Runtime</label>
              <select
                value={(config.runtime as string) || 'nodejs20.x'}
                onChange={(e) => updateConfig('runtime', e.target.value)}
              >
                <option value="nodejs20.x">Node.js 20.x</option>
                <option value="nodejs18.x">Node.js 18.x</option>
                <option value="python3.12">Python 3.12</option>
                <option value="python3.11">Python 3.11</option>
                <option value="python3.10">Python 3.10</option>
                <option value="java21">Java 21</option>
                <option value="java17">Java 17</option>
                <option value="dotnet8">. NET 8</option>
              </select>
            </div>
          </>
        )

      case 'DynamoDB':
        return (
          <>
            <div className="form-group">
              <label>Table Name</label>
              <input
                type="text"
                value={(config.tableName as string) || ''}
                onChange={(e) => updateConfig('tableName', e.target.value)}
                placeholder="my-table"
              />
            </div>
            <div className="form-group">
              <label>Billing Mode</label>
              <select
                value={(config.billingMode as string) || 'PAY_PER_REQUEST'}
                onChange={(e) => updateConfig('billingMode', e.target.value)}
              >
                <option value="PAY_PER_REQUEST">On-Demand</option>
                <option value="PROVISIONED">Provisioned</option>
              </select>
            </div>
            {config.billingMode === 'PROVISIONED' && (
              <>
                <div className="form-group">
                  <label>Read Capacity Units</label>
                  <input
                    type="number"
                    min="1"
                    value={(config.readCapacity as number) || 5}
                    onChange={(e) => updateConfig('readCapacity', parseInt(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>Write Capacity Units</label>
                  <input
                    type="number"
                    min="1"
                    value={(config.writeCapacity as number) || 5}
                    onChange={(e) => updateConfig('writeCapacity', parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
          </>
        )

      case 'S3':
        return (
          <>
            <div className="form-group">
              <label>Bucket Name</label>
              <input
                type="text"
                value={(config.bucketName as string) || ''}
                onChange={(e) => updateConfig('bucketName', e.target.value)}
                placeholder="my-bucket"
              />
              <span className="form-hint">Must be globally unique</span>
            </div>
            <div className="form-group">
              <label>Versioning</label>
              <select
                value={(config.versioning as string) || 'Disabled'}
                onChange={(e) => updateConfig('versioning', e.target.value)}
              >
                <option value="Disabled">Disabled</option>
                <option value="Enabled">Enabled</option>
              </select>
            </div>
            <div className="form-group">
              <label>Public Access</label>
              <select
                value={(config.publicAccess as string) || 'Blocked'}
                onChange={(e) => updateConfig('publicAccess', e.target.value)}
              >
                <option value="Blocked">Block All Public Access</option>
                <option value="Enabled">Allow Public Access</option>
              </select>
            </div>
          </>
        )

      case 'API Gateway':
        return (
          <>
            <div className="form-group">
              <label>API Type</label>
              <select
                value={(config.apiType as string) || 'REST'}
                onChange={(e) => updateConfig('apiType', e.target.value)}
              >
                <option value="REST">REST API</option>
                <option value="HTTP">HTTP API</option>
                <option value="WebSocket">WebSocket API</option>
              </select>
            </div>
            <div className="form-group">
              <label>Stage Name</label>
              <input
                type="text"
                value={(config.stageName as string) || 'prod'}
                onChange={(e) => updateConfig('stageName', e.target.value)}
                placeholder="prod"
              />
            </div>
            <div className="form-group">
              <label>Throttle (requests/sec)</label>
              <input
                type="number"
                min="1"
                value={(config.throttle as number) || 1000}
                onChange={(e) => updateConfig('throttle', parseInt(e.target.value))}
              />
            </div>
          </>
        )

      case 'RDS':
        return (
          <>
            <div className="form-group">
              <label>Engine</label>
              <select
                value={(config.engine as string) || 'postgres'}
                onChange={(e) => updateConfig('engine', e.target.value)}
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="mariadb">MariaDB</option>
                <option value="aurora-postgresql">Aurora PostgreSQL</option>
                <option value="aurora-mysql">Aurora MySQL</option>
              </select>
            </div>
            <div className="form-group">
              <label>Instance Class</label>
              <select
                value={(config.instanceClass as string) || 'db.t3.micro'}
                onChange={(e) => updateConfig('instanceClass', e.target.value)}
              >
                <option value="db.t3.micro">db.t3.micro</option>
                <option value="db.t3.small">db.t3.small</option>
                <option value="db.t3.medium">db.t3.medium</option>
                <option value="db.r5.large">db.r5.large</option>
                <option value="db.r5.xlarge">db.r5.xlarge</option>
              </select>
            </div>
            <div className="form-group">
              <label>Storage (GB)</label>
              <input
                type="number"
                min="20"
                max="65536"
                value={(config.storage as number) || 20}
                onChange={(e) => updateConfig('storage', parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <label>Multi-AZ</label>
              <select
                value={(config.multiAz as string) || 'false'}
                onChange={(e) => updateConfig('multiAz', e.target.value === 'true')}
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
          </>
        )

      case 'SQS':
        return (
          <>
            <div className="form-group">
              <label>Queue Name</label>
              <input
                type="text"
                value={(config.queueName as string) || ''}
                onChange={(e) => updateConfig('queueName', e.target.value)}
                placeholder="my-queue"
              />
            </div>
            <div className="form-group">
              <label>Queue Type</label>
              <select
                value={(config.queueType as string) || 'Standard'}
                onChange={(e) => updateConfig('queueType', e.target.value)}
              >
                <option value="Standard">Standard</option>
                <option value="FIFO">FIFO</option>
              </select>
            </div>
            <div className="form-group">
              <label>Visibility Timeout (seconds)</label>
              <input
                type="number"
                min="0"
                max="43200"
                value={(config.visibilityTimeout as number) || 30}
                onChange={(e) => updateConfig('visibilityTimeout', parseInt(e.target.value))}
              />
            </div>
          </>
        )

      case 'Cognito':
        return (
          <>
            <div className="form-group">
              <label>User Pool Name</label>
              <input
                type="text"
                value={(config.userPoolName as string) || ''}
                onChange={(e) => updateConfig('userPoolName', e.target.value)}
                placeholder="my-user-pool"
              />
            </div>
            <div className="form-group">
              <label>MFA</label>
              <select
                value={(config.mfa as string) || 'OPTIONAL'}
                onChange={(e) => updateConfig('mfa', e.target.value)}
              >
                <option value="OFF">Disabled</option>
                <option value="OPTIONAL">Optional</option>
                <option value="REQUIRED">Required</option>
              </select>
            </div>
            <div className="form-group">
              <label>Password Policy</label>
              <select
                value={(config.passwordPolicy as string) || 'medium'}
                onChange={(e) => updateConfig('passwordPolicy', e.target.value)}
              >
                <option value="low">Low (min 6 chars)</option>
                <option value="medium">Medium (min 8 chars, mixed case)</option>
                <option value="high">High (min 12 chars, all types)</option>
              </select>
            </div>
          </>
        )

      case 'SNS':
        return (
          <>
            <div className="form-group">
              <label>Topic Name</label>
              <input
                type="text"
                value={(config.topicName as string) || ''}
                onChange={(e) => updateConfig('topicName', e.target.value)}
                placeholder="my-topic"
              />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={(config.displayName as string) || ''}
                onChange={(e) => updateConfig('displayName', e.target.value)}
                placeholder="My Topic"
              />
            </div>
          </>
        )

      case 'CloudFront':
        return (
          <>
            <div className="form-group">
              <label>Price Class</label>
              <select
                value={(config.priceClass as string) || 'PriceClass_100'}
                onChange={(e) => updateConfig('priceClass', e.target.value)}
              >
                <option value="PriceClass_100">US, Canada, Europe</option>
                <option value="PriceClass_200">US, Canada, Europe, Asia, Africa</option>
                <option value="PriceClass_All">All Edge Locations</option>
              </select>
            </div>
            <div className="form-group">
              <label>HTTP Version</label>
              <select
                value={(config.httpVersion as string) || 'http2'}
                onChange={(e) => updateConfig('httpVersion', e.target.value)}
              >
                <option value="http2">HTTP/2</option>
                <option value="http2and3">HTTP/2 and HTTP/3</option>
              </select>
            </div>
          </>
        )

      case 'EventBridge':
        return (
          <>
            <div className="form-group">
              <label>Event Bus Name</label>
              <input
                type="text"
                value={(config.eventBusName as string) || 'default'}
                onChange={(e) => updateConfig('eventBusName', e.target.value)}
                placeholder="default"
              />
            </div>
          </>
        )

      default:
        return (
          <div className="no-config">
            <p>No specific configuration available for this service type.</p>
          </div>
        )
    }
  }

  return (
    <div className="service-config-form">
      <div className="form-group">
        <label>Service Type</label>
        <input type="text" value={serviceType} disabled className="input-disabled" />
      </div>
      <div className="form-group">
        <label>Display Name</label>
        <input
          type="text"
          value={(node.data.name as string) || ''}
          onChange={(e) => onNameChange(node.id, e.target.value)}
          placeholder="Enter service name"
        />
      </div>
      <div className="config-divider" />
      <h4 className="config-section-title">Service Configuration</h4>
      {renderServiceConfig()}
    </div>
  )
}
