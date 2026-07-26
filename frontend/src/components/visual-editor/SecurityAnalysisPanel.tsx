import React, { useState } from 'react';
import type { Architecture } from '../../types/architecture';

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
      const token = localStorage.getItem('idToken');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/architectures/analyze-security`,
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
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
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
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span style={{ fontSize: '32px' }}>🛡️</span>
              <div>
                <h2 className="text-2xl font-bold">Security Analysis</h2>
                <p className="text-purple-100 text-sm">Enterprise-grade security review</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!result && !isAnalyzing && (
            <div className="text-center py-12">
              <span style={{ fontSize: '96px', display: 'block', marginBottom: '24px' }}>🛡️</span>
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                Ready to Analyze Security
              </h3>
              <p className="text-gray-600 mb-6 max-w-xl mx-auto">
                Scan your architecture for security vulnerabilities, compliance issues, and best
                practice violations. Get AI-powered recommendations to make your architecture
                enterprise-grade.
              </p>
              <button
                onClick={analyzeSecurity}
                disabled={!architecture}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                Analyze Security
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">Analyzing architecture security...</p>
              <p className="text-gray-500 text-sm mt-2">Checking for vulnerabilities and compliance issues</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
              <div className="flex items-center">
                <span style={{ fontSize: '20px', marginRight: '12px' }}>❌</span>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Security Score */}
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-full p-4 shadow">
                      <span style={{ fontSize: '48px', display: 'block', lineHeight: 1 }} className={getScoreColor(result.score)}>🛡️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-700">Security Score</h3>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
                          {result.score}
                        </span>
                        <span className="text-gray-500">/100</span>
                        <span className={`ml-2 px-3 py-1 rounded-full text-sm font-semibold ${
                          result.score >= 90 ? 'bg-green-100 text-green-800' :
                          result.score >= 70 ? 'bg-yellow-100 text-yellow-800' :
                          result.score >= 50 ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {getScoreLabel(result.score)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Severity Counts */}
                  <div className="flex gap-4">
                    {result.criticalCount > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{result.criticalCount}</div>
                        <div className="text-xs text-gray-600">Critical</div>
                      </div>
                    )}
                    {result.highCount > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{result.highCount}</div>
                        <div className="text-xs text-gray-600">High</div>
                      </div>
                    )}
                    {result.mediumCount > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{result.mediumCount}</div>
                        <div className="text-xs text-gray-600">Medium</div>
                      </div>
                    )}
                    {result.lowCount > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{result.lowCount}</div>
                        <div className="text-xs text-gray-600">Low</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              {result.aiInsights && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <div className="flex items-start">
                    <span style={{ fontSize: '20px', marginRight: '12px', flexShrink: 0 }}>📊</span>
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-2">AI Security Insights</h4>
                      <p className="text-blue-800 text-sm whitespace-pre-line">{result.aiInsights}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
                  <h4 className="font-semibold text-yellow-900 mb-2">Priority Actions</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-yellow-800 text-sm">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Findings List */}
              {result.findings.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Security Findings ({result.totalFindings})
                  </h3>
                  <div className="space-y-3">
                    {result.findings.map((finding) => (
                      <div
                        key={finding.id}
                        className={`border rounded-lg p-4 ${getSeverityColor(finding.severity)} transition-all ${
                          selectedFindings.has(finding.id) ? 'ring-2 ring-purple-500' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {finding.autoFixable && (
                            <input
                              type="checkbox"
                              checked={selectedFindings.has(finding.id)}
                              onChange={() => toggleFinding(finding.id)}
                              className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                          )}
                          <div className="flex-shrink-0 mt-0.5">
                            <span style={{ fontSize: '20px' }}>{getSeverityIcon(finding.severity)}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div>
                                <h4 className="font-semibold text-sm">{finding.title}</h4>
                                <p className="text-xs opacity-75 mt-0.5">
                                  {finding.serviceName} • {finding.category}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="px-2 py-1 text-xs font-semibold rounded capitalize">
                                  {finding.severity}
                                </span>
                                {finding.autoFixable && (
                                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded flex items-center gap-1">
                                    <span>🔒</span>
                                    Auto-fix
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="text-sm mb-2">{finding.description}</p>
                            <div className="bg-white bg-opacity-50 rounded p-2 text-xs space-y-1">
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
                <div className="text-center py-8 bg-green-50 rounded-lg border border-green-200">
                  <span style={{ fontSize: '64px', display: 'block', marginBottom: '12px' }}>✅</span>
                  <h3 className="text-xl font-semibold text-green-800 mb-2">
                    No Security Issues Found!
                  </h3>
                  <p className="text-green-700">
                    Your architecture follows AWS security best practices.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {result && result.findings.length > 0 && (
          <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedFindings.size} of {result.findings.filter(f => f.autoFixable).length} auto-fixable issues selected
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleApplyFixes}
                disabled={selectedFindings.size === 0}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow"
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
