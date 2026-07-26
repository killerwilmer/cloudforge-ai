import { TokenStorage } from '@/utils/token-storage';
import React, { useState } from 'react';
import type { Architecture } from '../../types/architecture';
import './SecurityAnalysisPanel.css';

interface SecurityFinding {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  risk: string;
  remediation: string;
  effort: 'low' | 'medium' | 'high';
  autoFixable: boolean;
  changes?: {
    type: string;
    configuration: Record<string, any>;
  };
}

interface SecurityAnalysisResult {
  score: number;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  findings: SecurityFinding[];
  recommendations: string[];
  aiInsights: string;
}

interface SecurityAnalysisPanelProps {
  architecture: Architecture | null;
  onApplyFixes: (findings: SecurityFinding[]) => void;
  onClose: () => void;
}

const SecurityAnalysisPanel: React.FC<SecurityAnalysisPanelProps> = ({
  architecture,
  onApplyFixes,
  onClose,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SecurityAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindings, setSelectedFindings] = useState<Set<string>>(new Set());

  const analyzeSecurity = async () => {
    if (!architecture) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const token = TokenStorage.getIdToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://9awgal4oie.execute-api.us-east-1.amazonaws.com/prod';
      const response = await fetch(
        `${apiUrl}/api/architectures/analyze-security`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ architecture }),
        }
      );

      if (!response.ok) {
        throw new Error(`Security analysis failed: ${response.statusText}`);
      }

      const data: SecurityAnalysisResult = await response.json();
      setResult(data);

      // Auto-select all auto-fixable findings
      const autoFixableIds = data.findings
        .filter(f => f.autoFixable)
        .map(f => f.id);
      setSelectedFindings(new Set(autoFixableIds));
    } catch (err: any) {
      console.error('Security analysis error:', err);
      setError(err.message || 'Failed to analyze security');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFixes = () => {
    if (!result) return;

    const findingsToApply = result.findings.filter(f => selectedFindings.has(f.id));
    onApplyFixes(findingsToApply);
    onClose();
  };

  const toggleFinding = (findingId: string) => {
    const newSelected = new Set(selectedFindings);
    if (newSelected.has(findingId)) {
      newSelected.delete(findingId);
    } else {
      newSelected.add(findingId);
    }
    setSelectedFindings(newSelected);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'security-severity-critical';
      case 'high':
        return 'security-severity-high';
      case 'medium':
        return 'security-severity-medium';
      case 'low':
        return 'security-severity-low';
      default:
        return '';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return '❌';
      case 'medium':
        return '⚠️';
      case 'low':
        return 'ℹ️';
      default:
        return '✅';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green';
    if (score >= 70) return 'text-yellow';
    if (score >= 50) return 'text-orange';
    return 'text-red';
  };

  const getScoreLabelClass = (score: number) => {
    if (score >= 90) return 'bg-green';
    if (score >= 70) return 'bg-yellow';
    if (score >= 50) return 'bg-orange';
    return 'bg-red';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="security-analysis-overlay">
      <div className="security-analysis-panel">
        {/* Header */}
        <div className="security-panel-header">
          <div className="security-header-content">
            <span className="security-icon">🛡️</span>
            <div className="security-header-text">
              <h2>Security Analysis</h2>
              <p>Enterprise-grade security review</p>
            </div>
          </div>
          <button onClick={onClose} className="security-close-btn">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="security-panel-content">
          {!result && !isAnalyzing && (
            <div className="security-initial-state">
              <span className="security-initial-icon">🛡️</span>
              <h3>Ready to Analyze Security</h3>
              <p>
                Scan your architecture for security vulnerabilities, compliance issues, and best
                practice violations. Get AI-powered recommendations to make your architecture
                enterprise-grade.
              </p>
              <button
                onClick={analyzeSecurity}
                disabled={!architecture}
                className="security-analyze-btn"
              >
                Analyze Security
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="security-loading-state">
              <div className="security-spinner"></div>
              <p>Analyzing architecture security...</p>
              <p className="loading-subtitle">Checking for vulnerabilities and compliance issues</p>
            </div>
          )}

          {error && (
            <div className="security-error">
              <span className="security-error-icon">❌</span>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="security-results">
              {/* Security Score */}
              <div className="security-score-card">
                <div className="security-score-content">
                  <div className="security-score-left">
                    <div className="security-score-icon-wrapper">
                      <span className={`security-score-icon ${getScoreColor(result.score)}`}>🛡️</span>
                    </div>
                    <div className="security-score-details">
                      <h3>Security Score</h3>
                      <div className="security-score-value">
                        <span className={`security-score-number ${getScoreColor(result.score)}`}>
                          {result.score}
                        </span>
                        <span className="security-score-total">/100</span>
                        <span className={`security-score-label ${getScoreLabelClass(result.score)}`}>
                          {getScoreLabel(result.score)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="security-severity-counts">
                    {result.criticalCount > 0 && (
                      <div className="security-severity-item">
                        <span className="security-severity-count text-red">{result.criticalCount}</span>
                        <span className="security-severity-label">Critical</span>
                      </div>
                    )}
                    {result.highCount > 0 && (
                      <div className="security-severity-item">
                        <span className="security-severity-count text-orange">{result.highCount}</span>
                        <span className="security-severity-label">High</span>
                      </div>
                    )}
                    {result.mediumCount > 0 && (
                      <div className="security-severity-item">
                        <span className="security-severity-count text-yellow">{result.mediumCount}</span>
                        <span className="security-severity-label">Medium</span>
                      </div>
                    )}
                    {result.lowCount > 0 && (
                      <div className="security-severity-item">
                        <span className="security-severity-count" style={{color: '#3b82f6'}}>{result.lowCount}</span>
                        <span className="security-severity-label">Low</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              {result.aiInsights && (
                <div className="security-insights">
                  <div className="security-insights-content">
                    <span className="security-insights-icon">📊</span>
                    <div>
                      <h4>AI Security Insights</h4>
                      <p>{result.aiInsights}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="security-recommendations">
                  <div className="security-recommendations-content">
                    <span className="security-insights-icon">⚠️</span>
                    <div>
                      <h4>Priority Actions</h4>
                      <ul className="security-recommendations-list">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Findings List */}
              {result.findings.length > 0 ? (
                <div className="security-findings-section">
                  <h3>Security Findings ({result.totalFindings})</h3>
                  <div className="security-findings-list">
                    {result.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className={`security-finding-card ${selectedFindings.has(finding.id) ? 'selected' : ''}`}
                      >
                        <div className="security-finding-content">
                          {finding.autoFixable && (
                            <input
                              type="checkbox"
                              checked={selectedFindings.has(finding.id)}
                              onChange={() => toggleFinding(finding.id)}
                              className="security-finding-checkbox"
                            />
                          )}
                          <span className="security-finding-icon">{getSeverityIcon(finding.severity)}</span>
                          <div className="security-finding-details">
                            <div className="security-finding-header">
                              <div className="security-finding-title">
                                <h4>{finding.title}</h4>
                                <p className="security-finding-meta">
                                  {finding.serviceName} • {finding.category}
                                </p>
                              </div>
                              <div className="security-finding-badges">
                                <span className={`security-severity-badge ${getSeverityColor(finding.severity)}`}>
                                  {finding.severity}
                                </span>
                                {finding.autoFixable && (
                                  <span className="security-autofix-badge">
                                    <span>🔒</span>
                                    Auto-fix
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="security-finding-description">{finding.description}</p>
                            <div className="security-finding-info">
                              <p><strong>Risk:</strong> {finding.risk}</p>
                              <p><strong>Remediation:</strong> {finding.remediation}</p>
                              <p><strong>Effort:</strong> <span className="capitalize">{finding.effort}</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="security-success-state">
                  <span className="security-success-icon">✅</span>
                  <h3>No Security Issues Found!</h3>
                  <p>Your architecture follows AWS security best practices.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.findings.length > 0 && (
          <div className="security-panel-footer">
            <div className="security-footer-info">
              {selectedFindings.size} of {result.findings.filter(f => f.autoFixable).length} auto-fixable issues selected
            </div>
            <div className="security-footer-actions">
              <button
                onClick={onClose}
                className="security-footer-btn security-footer-btn-secondary"
              >
                Close
              </button>
              <button
                onClick={handleApplyFixes}
                disabled={selectedFindings.size === 0}
                className="security-footer-btn security-footer-btn-primary"
              >
                Apply {selectedFindings.size} Fix{selectedFindings.size !== 1 ? 'es' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecurityAnalysisPanel;
