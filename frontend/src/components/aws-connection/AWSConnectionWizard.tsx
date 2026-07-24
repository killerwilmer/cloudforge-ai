import { awsConnectionService, type AWSConnection } from '@/services/aws-connection.service';
import { TokenStorage } from '@/utils/token-storage';
import { useState } from 'react';
import './AWSConnectionWizard.css';

interface AWSConnectionWizardProps {
  onClose: () => void;
  onConnected: (connection: AWSConnection) => void;
}

export function AWSConnectionWizard({ onClose, onConnected }: AWSConnectionWizardProps) {
  const [step, setStep] = useState<'instructions' | 'form' | 'connecting' | 'success'>('instructions');
  const [roleArn, setRoleArn] = useState('');
  const [externalId, setExternalId] = useState('');
  const [accountAlias, setAccountAlias] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<AWSConnection | null>(null);

  // Generate a unique external ID for this user
  const generatedExternalId = `cloudforge-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const handleConnect = async () => {
    setError(null);
    setStep('connecting');

    const accessToken = TokenStorage.getIdToken();
    if (!accessToken) {
      setError('Not authenticated. Please sign in again.');
      setStep('form');
      return;
    }

    try {
      const response = await awsConnectionService.connect(
        {
          roleArn: roleArn.trim(),
          externalId: externalId.trim() || undefined,
          accountAlias: accountAlias.trim() || undefined,
        },
        accessToken
      );

      setConnection(response.connection);
      setStep('success');
      onConnected(response.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect AWS account');
      setStep('form');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog-content aws-connection-dialog">
        <div className="dialog-header">
          <h3>Connect AWS Account</h3>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          {/* Step 1: Instructions */}
          {step === 'instructions' && (
            <div className="wizard-step">
              <h4>Setup Instructions</h4>
              <p>To connect your AWS account, you need to create an IAM Role that CloudForge can assume.</p>

              <div className="instructions-section">
                <h5>Step 1: Create IAM Role</h5>
                <ol>
                  <li>
                    Go to the{' '}
                    <a href="https://console.aws.amazon.com/iam/home#/roles" target="_blank" rel="noopener noreferrer">
                      AWS IAM Console
                    </a>
                  </li>
                  <li>Click "Create role"</li>
                  <li>Select "AWS account" as the trusted entity type</li>
                  <li>Select "Another AWS account"</li>
                  <li>
                    Enter Account ID: <code className="inline-code">610595225024</code>
                    <button
                      className="btn-copy-inline"
                      onClick={() => copyToClipboard('610595225024')}
                      title="Copy account ID"
                    >
                      📋
                    </button>
                  </li>
                  <li>
                    Check "Require external ID" and enter:{' '}
                    <code className="inline-code">{generatedExternalId}</code>
                    <button
                      className="btn-copy-inline"
                      onClick={() => copyToClipboard(generatedExternalId)}
                      title="Copy external ID"
                    >
                      📋
                    </button>
                  </li>
                </ol>
              </div>

              <div className="instructions-section">
                <h5>Step 2: Attach Permissions</h5>
                <p>Attach the following AWS managed policy (or create a custom policy with similar permissions):</p>
                <ul>
                  <li>
                    <code>PowerUserAccess</code> (recommended for full CloudFormation deployment)
                  </li>
                  <li>
                    Or <code>CloudFormationFullAccess</code> + service-specific permissions
                  </li>
                </ul>
                <p className="warning-text">
                  ⚠️ <strong>Important:</strong> CloudForge will only use these credentials to deploy CloudFormation
                  stacks. Review the permissions before granting access.
                </p>
              </div>

              <div className="instructions-section">
                <h5>Step 3: Copy Role ARN</h5>
                <ol>
                  <li>Complete the role creation</li>
                  <li>Click on the newly created role</li>
                  <li>Copy the Role ARN (it looks like: arn:aws:iam::123456789012:role/YourRoleName)</li>
                </ol>
              </div>

              <button className="btn btn-primary" onClick={() => setStep('form')}>
                I've Created the Role
              </button>
            </div>
          )}

          {/* Step 2: Form */}
          {step === 'form' && (
            <div className="wizard-step">
              <h4>Enter Connection Details</h4>

              {error && (
                <div className="error-message">
                  <strong>Connection Failed</strong>
                  <p>{error}</p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="roleArn">
                  IAM Role ARN <span className="required">*</span>
                </label>
                <input
                  id="roleArn"
                  type="text"
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="arn:aws:iam::123456789012:role/CloudForgeRole"
                  className="form-input"
                />
                <span className="field-hint">The ARN of the IAM role you created</span>
              </div>

              <div className="form-group">
                <label htmlFor="externalId">External ID (optional)</label>
                <input
                  id="externalId"
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  placeholder={generatedExternalId}
                  className="form-input"
                />
                <span className="field-hint">Leave blank if you didn't configure an external ID</span>
              </div>

              <div className="form-group">
                <label htmlFor="accountAlias">Account Alias (optional)</label>
                <input
                  id="accountAlias"
                  type="text"
                  value={accountAlias}
                  onChange={(e) => setAccountAlias(e.target.value)}
                  placeholder="My Production Account"
                  maxLength={100}
                  className="form-input"
                />
                <span className="field-hint">A friendly name for this AWS account</span>
              </div>

              <div className="button-group">
                <button className="btn btn-secondary" onClick={() => setStep('instructions')}>
                  ← Back to Instructions
                </button>
                <button className="btn btn-primary" onClick={handleConnect} disabled={!roleArn.trim()}>
                  Connect Account
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Connecting */}
          {step === 'connecting' && (
            <div className="wizard-step connecting-step">
              <div className="spinner"></div>
              <p>Connecting to AWS account...</p>
              <p className="connecting-hint">This may take a few seconds</p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 'success' && connection && (
            <div className="wizard-step success-step">
              <div className="success-icon">✓</div>
              <h4>Connected Successfully!</h4>
              <p>Your AWS account is now connected to CloudForge.</p>

              <div className="connection-details">
                <div className="detail-row">
                  <span className="detail-label">Account ID:</span>
                  <span className="detail-value">{connection.accountId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Account Alias:</span>
                  <span className="detail-value">{connection.accountAlias}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Role ARN:</span>
                  <span className="detail-value detail-value-small">{connection.roleArn}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Expires:</span>
                  <span className="detail-value">{new Date(connection.expiresAt).toLocaleString()}</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
