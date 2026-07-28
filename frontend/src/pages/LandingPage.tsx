import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

export function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/generate')
    } else {
      navigate('/auth')
    }
  }

  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-icon">☁️</span>
            <span className="logo-text">CloudForge AI</span>
          </div>
          <div className="nav-actions">
            {isAuthenticated ? (
              <>
                <span className="user-greeting">Welcome, {user?.email}</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('/generate')}
                >
                  Go to Dashboard
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/auth')}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Design AWS Architectures
            <br />
            <span className="hero-highlight">Powered by AI</span>
          </h1>
          <p className="hero-description">
            Describe your problem in plain English and let AI design the perfect
            AWS architecture. Generate infrastructure-as-code, visualize your
            system, and deploy with confidence.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-large"
              onClick={handleGetStarted}
            >
              Get Started Free
            </button>
            <a href="#features" className="btn btn-secondary btn-large">
              Learn More
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="architecture-preview">
            <div className="preview-node api-gateway">API Gateway</div>
            <div className="preview-node lambda">Lambda</div>
            <div className="preview-node dynamodb">DynamoDB</div>
            <div className="preview-connection connection-1" />
            <div className="preview-connection connection-2" />
          </div>
        </div>
      </section>

      <section id="features" className="features-section">
        <h2 className="section-title">Powerful Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>AI-Powered Design</h3>
            <p>
              Leverages Amazon Bedrock and Claude 3.5 Sonnet to understand your
              requirements and generate optimal AWS architectures.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Visual Editor</h3>
            <p>
              Interactive canvas to visualize, edit, and refine your
              architecture with drag-and-drop components.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Infrastructure as Code</h3>
            <p>
              Automatically generate CloudFormation templates ready to deploy
              your architecture to AWS.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Secure & Scalable</h3>
            <p>
              Built with AWS best practices, featuring Cognito authentication
              and serverless architecture.
            </p>
          </div>
        </div>
      </section>

      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Describe Your Problem</h3>
            <p>
              Tell us what you need in plain English. "I need a REST API with
              authentication and database storage."
            </p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>AI Generates Architecture</h3>
            <p>
              Our AI analyzes your requirements and designs an optimal AWS
              architecture with the right services.
            </p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Visualize & Refine</h3>
            <p>
              Review the visual diagram, make adjustments in the editor, and
              generate deployment templates.
            </p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Deploy to AWS</h3>
            <p>
              Export CloudFormation templates and deploy your infrastructure
              with a single click.
            </p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2>Ready to Build?</h2>
        <p>Start designing your AWS architecture in minutes</p>
        <button
          type="button"
          className="btn btn-primary btn-large"
          onClick={handleGetStarted}
        >
          Get Started Now
        </button>
      </section>

      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="logo-icon">☁️</span>
            <span className="logo-text">CloudForge AI</span>
          </div>
          <div className="footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="https://github.com/killerwilmer" target="_blank" rel="noopener">
              GitHub
            </a>
          </div>
          <div className="footer-credits">
            <p>Powered by Amazon Bedrock & AWS CDK</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
