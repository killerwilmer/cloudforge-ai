import { AWSConnectionStatus } from '@/components/aws-connection/AWSConnectionStatus';
import './AWSConnectionPage.css';

export function AWSConnectionPage() {
  return (
    <div className="aws-connection-page">
      <div className="aws-connection-container">
        <header className="page-header">
          <h1>AWS Account Connection</h1>
          <p className="page-description">
            Connect your AWS account to deploy CloudFormation stacks directly
            from CloudForge AI. We use secure IAM AssumeRole with temporary
            credentials.
          </p>
        </header>

        <div className="connection-content">
          <AWSConnectionStatus />
        </div>

        <div className="security-info">
          <h3>🔒 Security Information</h3>
          <div className="security-grid">
            <div className="security-item">
              <h4>Temporary Credentials</h4>
              <p>
                We use AWS STS AssumeRole to obtain temporary credentials that
                expire after 1 hour. You can refresh or disconnect at any time.
              </p>
            </div>
            <div className="security-item">
              <h4>External ID Protection</h4>
              <p>
                Each connection uses a unique external ID to prevent confused
                deputy attacks. This ensures only you can access your AWS
                account.
              </p>
            </div>
            <div className="security-item">
              <h4>Encrypted Storage</h4>
              <p>
                Credentials are stored in AWS Secrets Manager with encryption
                at rest. We never store your AWS access keys or passwords.
              </p>
            </div>
            <div className="security-item">
              <h4>Minimal Permissions</h4>
              <p>
                You control which permissions the IAM role has. Grant only what
                CloudForge needs to deploy your infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
