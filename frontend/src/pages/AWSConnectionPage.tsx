import { Navbar } from '@/components/Navbar';
import { AWSConnectionStatus } from '@/components/aws-connection/AWSConnectionStatus';
import './AWSConnectionPage.css';

export function AWSConnectionPage() {
  return (
    <>
      <Navbar />
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

          <div className="next-steps-section">
            <h3>🚀 What's Next?</h3>
            <div className="next-steps-cards">
              <div className="next-step-card">
                <div className="step-number">1</div>
                <h4>Generate Architecture</h4>
                <p>
                  Describe your application in plain English and let AI generate
                  an AWS architecture diagram for you.
                </p>
                <button
                  className="btn-secondary"
                  onClick={() => (window.location.href = '/generate')}
                >
                  Go to Generate →
                </button>
              </div>

              <div className="next-step-card">
                <div className="step-number">2</div>
                <h4>Edit Visually</h4>
                <p>
                  Customize your architecture using our drag-and-drop visual
                  editor. Add services, configure properties, and connect
                  components.
                </p>
                <button
                  className="btn-secondary"
                  onClick={() => (window.location.href = '/editor')}
                >
                  Go to Editor →
                </button>
              </div>

              <div className="next-step-card">
                <div className="step-number">3</div>
                <h4>Deploy to AWS</h4>
                <p>
                  One-click deployment to your connected AWS account. Monitor
                  deployment progress and view CloudFormation stack resources
                  in real-time.
                </p>
                <button
                  className="btn-secondary"
                  onClick={() => (window.location.href = '/deployments')}
                >
                  View Deployments →
                </button>
              </div>
            </div>
          </div>
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
    </>
  );
}
