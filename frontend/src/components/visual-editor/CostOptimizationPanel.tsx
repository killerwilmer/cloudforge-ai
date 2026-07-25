import { useState } from 'react';
import type { Architecture } from '@/types';
import './CostOptimizationPanel.css';

interface ServiceCost {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  monthlyCost: number;
  breakdown: {
    component: string;
    cost: number;
    unit: string;
  }[];
}

interface CostEstimate {
  totalMonthlyCost: number;
  services: ServiceCost[];
  assumptions: string[];
  lastUpdated: string;
}

interface OptimizationRecommendation {
  serviceId: string;
  serviceName: string;
  currentService: string;
  currentMonthlyCost: number;
  recommendedService: string;
  recommendedMonthlyCost: number;
  monthlySavings: number;
  savingsPercentage: number;
  reasoning: string;
  changes: {
    type: string;
    configuration: Record<string, any>;
  };
}

interface CostOptimizationResult {
  totalCurrentCost: number;
  totalOptimizedCost: number;
  totalMonthlySavings: number;
  savingsPercentage: number;
  recommendations: OptimizationRecommendation[];
  optimizedArchitecture: Architecture;
}

interface CostOptimizationPanelProps {
  architecture: Architecture;
  onApplyOptimizations: (optimizedArchitecture: Architecture) => void;
  onClose: () => void;
}

export function CostOptimizationPanel({
  architecture,
  onApplyOptimizations,
  onClose,
}: CostOptimizationPanelProps) {
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [optimizationResult, setOptimizationResult] = useState<CostOptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);

  const handleEstimateCost = async () => {
    setLoading(true);
    setError(null);
    setOptimizationResult(null);

    try {
      const token = localStorage.getItem('idToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/architectures/estimate-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ architecture }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to estimate cost');
      }

      const estimate = await response.json();
      setCostEstimate(estimate);
    } catch (err: any) {
      console.error('Cost estimation error:', err);
      setError(err.message || 'Failed to estimate cost');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeCost = async () => {
    if (!costEstimate) {
      setError('Please estimate cost first');
      return;
    }

    setOptimizing(true);
    setError(null);

    try {
      const token = localStorage.getItem('idToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${apiUrl}/api/architectures/optimize-cost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          architecture,
          currentCosts: costEstimate.services,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to optimize cost');
      }

      const result = await response.json();
      setOptimizationResult(result);
    } catch (err: any) {
      console.error('Cost optimization error:', err);
      setError(err.message || 'Failed to optimize cost');
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimizations = () => {
    if (optimizationResult?.optimizedArchitecture) {
      onApplyOptimizations(optimizationResult.optimizedArchitecture);
      onClose();
    }
  };

  return (
    <div className="cost-optimization-overlay">
      <div className="cost-optimization-panel">
        <div className="panel-header">
          <h2>💰 Cost Optimization</h2>
          <button className="btn-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="panel-content">
          {/* Estimate Cost Section */}
          {!costEstimate && (
            <div className="section">
              <p className="section-description">
                Analyze your architecture to estimate monthly AWS costs and discover optimization opportunities.
              </p>
              <button
                className="btn btn-primary"
                onClick={handleEstimateCost}
                disabled={loading || architecture.services.length === 0}
              >
                {loading ? 'Calculating...' : '📊 Estimate Monthly Cost'}
              </button>
            </div>
          )}

          {/* Cost Estimate Display */}
          {costEstimate && !optimizationResult && (
            <div className="section">
              <div className="cost-summary">
                <div className="cost-total">
                  <span className="cost-label">Estimated Monthly Cost</span>
                  <span className="cost-value">
                    ${costEstimate.totalMonthlyCost.toFixed(2)}/month
                  </span>
                </div>
              </div>

              <div className="services-breakdown">
                <h3>Cost Breakdown by Service</h3>
                {costEstimate.services.map((service) => (
                  <div key={service.serviceId} className="service-cost-card">
                    <div className="service-cost-header">
                      <div>
                        <div className="service-cost-name">{service.serviceName}</div>
                        <div className="service-cost-type">{service.serviceType}</div>
                      </div>
                      <div className="service-cost-amount">
                        ${service.monthlyCost.toFixed(2)}/mo
                      </div>
                    </div>
                    <div className="service-cost-breakdown">
                      {service.breakdown.map((item, idx) => (
                        <div key={idx} className="breakdown-item">
                          <span className="breakdown-component">{item.component}</span>
                          <span className="breakdown-cost">
                            ${item.cost.toFixed(2)} ({item.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {costEstimate.assumptions && costEstimate.assumptions.length > 0 && (
                <div className="assumptions-section">
                  <button
                    className="assumptions-toggle"
                    onClick={() => setShowAssumptions(!showAssumptions)}
                  >
                    {showAssumptions ? '▼' : '▶'} Cost Assumptions
                  </button>
                  {showAssumptions && (
                    <ul className="assumptions-list">
                      {costEstimate.assumptions.map((assumption, idx) => (
                        <li key={idx}>{assumption}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={handleOptimizeCost}
                  disabled={optimizing}
                >
                  {optimizing ? 'Analyzing...' : '✨ Reduce Costs with AI'}
                </button>
                <button className="btn btn-secondary" onClick={handleEstimateCost}>
                  🔄 Recalculate
                </button>
              </div>
            </div>
          )}

          {/* Optimization Results */}
          {optimizationResult && (
            <div className="section">
              <div className="optimization-summary">
                <div className="savings-card">
                  <div className="savings-header">
                    <span className="savings-icon">💡</span>
                    <span className="savings-title">Potential Monthly Savings</span>
                  </div>
                  <div className="savings-amount">
                    ${optimizationResult.totalMonthlySavings.toFixed(2)}/month
                  </div>
                  <div className="savings-percentage">
                    {optimizationResult.savingsPercentage.toFixed(1)}% reduction
                  </div>
                  <div className="cost-comparison">
                    <div className="cost-item">
                      <span className="cost-item-label">Current:</span>
                      <span className="cost-item-value">
                        ${optimizationResult.totalCurrentCost.toFixed(2)}/mo
                      </span>
                    </div>
                    <div className="cost-arrow">→</div>
                    <div className="cost-item optimized">
                      <span className="cost-item-label">Optimized:</span>
                      <span className="cost-item-value">
                        ${optimizationResult.totalOptimizedCost.toFixed(2)}/mo
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {optimizationResult.recommendations.length > 0 ? (
                <>
                  <div className="recommendations-list">
                    <h3>💰 Optimization Recommendations</h3>
                    {optimizationResult.recommendations.map((rec, idx) => (
                      <div key={idx} className="recommendation-card">
                        <div className="rec-header">
                          <div className="rec-title">
                            <span className="rec-icon">🔧</span>
                            {rec.serviceName}
                          </div>
                          <div className="rec-savings">
                            Save ${rec.monthlySavings.toFixed(2)}/mo
                            <span className="rec-percentage">
                              ({rec.savingsPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="rec-body">
                          <div className="rec-change">
                            <span className="change-from">{rec.currentService}</span>
                            <span className="change-arrow">→</span>
                            <span className="change-to">{rec.recommendedService}</span>
                          </div>
                          <div className="rec-reasoning">{rec.reasoning}</div>
                          <div className="rec-costs">
                            <span className="cost-current">
                              Current: ${rec.currentMonthlyCost.toFixed(2)}/mo
                            </span>
                            <span className="cost-optimized">
                              Optimized: ${rec.recommendedMonthlyCost.toFixed(2)}/mo
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="action-buttons">
                    <button
                      className="btn btn-success"
                      onClick={handleApplyOptimizations}
                    >
                      ✅ Apply All Optimizations
                    </button>
                    <button className="btn btn-secondary" onClick={() => setOptimizationResult(null)}>
                      ← Back to Cost Estimate
                    </button>
                  </div>
                </>
              ) : (
                <div className="no-recommendations">
                  <div className="no-rec-icon">✅</div>
                  <h3>Your architecture is already optimized!</h3>
                  <p>No significant cost savings found. Your current configuration follows AWS best practices.</p>
                  <button className="btn btn-secondary" onClick={() => setOptimizationResult(null)}>
                    ← Back to Cost Estimate
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          {/* Empty State */}
          {architecture.services.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>No Services in Architecture</h3>
              <p>Add some AWS services to your architecture to estimate costs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
