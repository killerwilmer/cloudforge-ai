import type { Architecture } from '@/types';
import { getServiceColor, getServiceIcon } from '@/utils/aws-icons';
import type { Edge, Node } from '@xyflow/react';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import './CostComparisonView.css';

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

interface CostComparisonViewProps {
  originalArchitecture: Architecture;
  optimizedArchitecture: Architecture;
  recommendations: OptimizationRecommendation[];
  totalSavings: number;
  savingsPercentage: number;
  onApply: () => void;
  onClose: () => void;
}

function getConfigSummary(service: any, _recommendation?: OptimizationRecommendation): string {
  const config = service.configuration || {};
  
  // Note: For optimized services, the backend already merged the changes into service.configuration
  // So we can just read from config directly for both original and optimized
  const parts: string[] = [];
  
  // Lambda
  if (service.type === 'Lambda') {
    if (config.memory) parts.push(`${config.memory}MB`);
    // Always show architecture, default to x86_64 if not specified
    const arch = config.architecture || 'x86_64';
    parts.push(arch === 'arm64' ? 'Graviton2' : 'x86_64');
    if (config.runtime) parts.push(config.runtime);
  }
  
  // API Gateway
  if (service.type === 'APIGateway') {
    if (config.apiType === 'HTTP') {
      parts.push('HTTP API');
    } else {
      parts.push('REST API');
    }
  }
  
  // DynamoDB
  if (service.type === 'DynamoDB') {
    if (config.billingMode === 'PAY_PER_REQUEST') parts.push('On-Demand');
    if (config.billingMode === 'PROVISIONED') parts.push('Provisioned');
    if (config.encryption) parts.push('Encrypted');
  }
  
  // RDS
  if (service.type === 'RDS') {
    if (config.instanceClass) parts.push(config.instanceClass);
    if (config.engine) parts.push(config.engine);
    if (config.multiAZ) parts.push('Multi-AZ');
  }
  
  // S3
  if (service.type === 'S3') {
    if (config.versioning) parts.push('Versioning');
    if (config.encryption) parts.push('Encrypted');
    if (config.storageClass) parts.push(config.storageClass);
  }
  
  // SQS
  if (service.type === 'SQS') {
    if (config.fifo) parts.push('FIFO');
    if (config.messageRetentionPeriod) parts.push(`${config.messageRetentionPeriod}s retention`);
  }
  
  // SNS
  if (service.type === 'SNS') {
    if (config.encryption) parts.push('Encrypted');
    if (config.fifo) parts.push('FIFO');
  }
  
  // Cognito
  if (service.type === 'Cognito') {
    if (config.mfa) parts.push(`MFA: ${config.mfa}`);
    if (config.emailVerification) parts.push('Email Verify');
  }
  
  // CloudFront
  if (service.type === 'CloudFront') {
    if (config.priceClass) parts.push(config.priceClass);
    if (config.sslProtocol) parts.push(config.sslProtocol);
  }
  
  // CloudWatch
  if (service.type === 'CloudWatch') {
    if (config.logRetention) parts.push(`${config.logRetention}d retention`);
  }
  
  return parts.join(' • ');
}

function architectureToNodes(architecture: Architecture, isOptimized: boolean, recommendations: OptimizationRecommendation[]): Node[] {
  return architecture.services.map((service) => {
    const ServiceIcon = getServiceIcon(service.type);
    const color = getServiceColor(service.type);
    const recommendation = recommendations.find(r => r.serviceId === service.id);
    
    // Check if this service was optimized
    const wasOptimized = isOptimized && recommendation;
    const configSummary = getConfigSummary(service, wasOptimized ? recommendation : undefined);
    
    return {
      id: service.id,
      type: 'default',
      position: service.position,
      data: {
        label: (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <ServiceIcon size={24} />
            <div style={{ fontSize: '10px', fontWeight: '600', textAlign: 'center', lineHeight: 1.2 }}>
              {service.name}
            </div>
            {configSummary && (
              <div
                style={{
                  fontSize: '8px',
                  opacity: 0.9,
                  fontWeight: '500',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  marginTop: '2px',
                  maxWidth: '150px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {configSummary}
              </div>
            )}
            {wasOptimized && (
              <div
                style={{
                  position: 'absolute',
                  top: '-8px',
                  right: '-8px',
                  background: '#10b981',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '2px 6px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                -${recommendation.monthlySavings.toFixed(0)}/mo
              </div>
            )}
          </div>
        ),
        name: service.name,
        serviceType: service.type,
        configuration: service.configuration,
      },
      style: {
        background: wasOptimized ? '#10b981' : color,
        color: 'white',
        border: wasOptimized ? '3px solid #059669' : '1px solid rgba(255,255,255,0.2)',
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '10px',
        fontWeight: '600',
        minWidth: '140px',
        maxWidth: '200px',
        textAlign: 'center',
        boxShadow: wasOptimized
          ? '0 0 20px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.3)',
      },
    };
  });
}

function architectureToEdges(architecture: Architecture): Edge[] {
  return architecture.connections.map((connection) => ({
    id: connection.id,
    source: connection.sourceId,
    target: connection.targetId,
    animated: connection.type === 'async',
    label: connection.protocol,
    style: { stroke: '#fff', strokeWidth: 2 },
  }));
}

export function CostComparisonView({
  originalArchitecture,
  optimizedArchitecture,
  recommendations,
  totalSavings,
  savingsPercentage,
  onApply,
  onClose,
}: CostComparisonViewProps) {
  const originalNodes = useMemo(
    () => architectureToNodes(originalArchitecture, false, recommendations),
    [originalArchitecture, recommendations]
  );
  
  const originalEdges = useMemo(
    () => architectureToEdges(originalArchitecture),
    [originalArchitecture]
  );
  
  const optimizedNodes = useMemo(
    () => architectureToNodes(optimizedArchitecture, true, recommendations),
    [optimizedArchitecture, recommendations]
  );
  
  const optimizedEdges = useMemo(
    () => architectureToEdges(optimizedArchitecture),
    [optimizedArchitecture]
  );

  return (
    <div className="cost-comparison-overlay">
      <div className="cost-comparison-container">
        {/* Header */}
        <div className="comparison-header">
          <div className="header-content">
            <h2>💰 Cost Optimization Comparison</h2>
            <div className="savings-summary">
              <div className="savings-badge">
                <span className="savings-label">Potential Savings:</span>
                <span className="savings-amount">${totalSavings.toFixed(2)}/month</span>
                <span className="savings-percent">({savingsPercentage.toFixed(1)}% reduction)</span>
              </div>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={onApply}>
              ✅ Apply All Optimizations
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              ✕ Close
            </button>
          </div>
        </div>

        {/* Split View */}
        <div className="comparison-content">
          {/* Original Architecture */}
          <div className="comparison-panel">
            <div className="panel-header original">
              <h3>📊 Current Architecture</h3>
              <div className="cost-badge">
                ${recommendations.reduce((sum, r) => sum + r.currentMonthlyCost, 0).toFixed(2)}/month
              </div>
            </div>
            <div className="panel-canvas">
              <ReactFlow
                nodes={originalNodes}
                edges={originalEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={true}
                minZoom={0.5}
                maxZoom={1.5}
              >
                <Background />
                <Controls />
                <MiniMap zoomable pannable />
              </ReactFlow>
            </div>
          </div>

          {/* Optimized Architecture */}
          <div className="comparison-panel">
            <div className="panel-header optimized">
              <h3>✨ Optimized Architecture</h3>
              <div className="cost-badge optimized">
                ${recommendations.reduce((sum, r) => sum + r.recommendedMonthlyCost, 0).toFixed(2)}/month
              </div>
            </div>
            <div className="panel-canvas">
              <ReactFlow
                nodes={optimizedNodes}
                edges={optimizedEdges}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={true}
                minZoom={0.5}
                maxZoom={1.5}
              >
                <Background />
                <Controls />
                <MiniMap zoomable pannable />
              </ReactFlow>
            </div>
          </div>
        </div>

        {/* Recommendations List */}
        <div className="recommendations-footer">
          <h3>🎯 Optimization Changes</h3>
          <div className="recommendations-list">
            {recommendations.map((rec) => (
              <div key={rec.serviceId} className="recommendation-item">
                <div className="recommendation-header">
                  <span className="service-name">{rec.serviceName}</span>
                  <span className="savings-badge">
                    -${rec.monthlySavings.toFixed(2)}/mo ({rec.savingsPercentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="recommendation-change">
                  <span className="change-from">{rec.currentService}</span>
                  <span className="change-arrow">→</span>
                  <span className="change-to">{rec.recommendedService}</span>
                </div>
                <div className="recommendation-reasoning">{rec.reasoning}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
