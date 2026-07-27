import { Navbar } from '@/components/Navbar'
import { CloudFormationPreview } from '@/components/visual-editor/CloudFormationPreview'
import { CostComparisonView } from '@/components/visual-editor/CostComparisonView'
import { CostOptimizationPanel } from '@/components/visual-editor/CostOptimizationPanel'
import { CustomEdge } from '@/components/visual-editor/CustomEdge'
import { LoadDiagramDialog } from '@/components/visual-editor/LoadDiagramDialog'
import { SaveDiagramDialog } from '@/components/visual-editor/SaveDiagramDialog'
import SecurityAnalysisPanel from '@/components/visual-editor/SecurityAnalysisPanel'
import { ServiceConfigForm } from '@/components/visual-editor/ServiceConfigForm'
import { useArchitecture } from '@/contexts/ArchitectureContext'
import { diagramService } from '@/services/diagram.service'
import type { Architecture, AWSService, ServiceConnection } from '@/types'
import { detectAndApplyLayout } from '@/utils/auto-layout'
import { AWS_SERVICES, getServiceColor, getServiceIcon } from '@/utils/aws-icons'
import {
    getConnectionProtocol,
    getConnectionType,
    validateConnection,
} from '@/utils/connection-validator'
import { TokenStorage } from '@/utils/token-storage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
    addEdge,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
    useReactFlow,
    type Connection,
    type Edge,
    type EdgeTypes,
    type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import './VisualEditorPage.css'

// Define custom edge types
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
}

/**
 * Format node label with title and optional subtitle
 * Example: "Create Todo" + "Handler" = "Create Todo\nHandler" with smaller subtitle
 */
const formatNodeLabel = (name: string, ServiceIcon: React.ComponentType<{ size?: number | string }>) => {
  // Split on common patterns: "Handler", "Role", "Function", etc.
  const patterns = /(.*?)\s+(Handler|Function|Role|Table|API|Service|Execution Role|User Pool|Queue|Topic|Bus|Database|Instance|Distribution|Stack|Group)$/i
  const match = name.match(patterns)
  
  if (match) {
    const title = match[1].trim()
    const subtitle = match[2].trim()
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ServiceIcon size={12} />
          <span style={{ fontSize: '9px', fontWeight: '600', lineHeight: '1.2' }}>{title}</span>
        </div>
        <span style={{ fontSize: '8px', fontWeight: '400', opacity: 0.85, lineHeight: '1' }}>{subtitle}</span>
      </div>
    )
  }
  
  // No subtitle pattern found - show icon + full name
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <ServiceIcon size={12} />
      <span style={{ fontSize: '9px', fontWeight: '600', lineHeight: '1.2' }}>{name}</span>
    </div>
  )
}

interface VisualEditorPageProps {
  initialArchitecture?: Architecture
}

export function VisualEditorPage({ initialArchitecture }: VisualEditorPageProps) {
  const location = useLocation()
  const { architecture: contextArchitecture, setArchitecture: setContextArchitecture } = useArchitecture()
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false)
  const hasChangesRef = useRef(false)
  const autoSaveIntervalRef = useRef<number | null>(null)
  
  // Diagram persistence state
  const [currentDiagramId, setCurrentDiagramId] = useState<string | null>(null)
  const [currentDiagramName, setCurrentDiagramName] = useState<string>('Untitled Architecture')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)
  const [showCloudFormationPreview, setShowCloudFormationPreview] = useState(false)
  const [showCostOptimization, setShowCostOptimization] = useState(false)
  const [showCostComparison, setShowCostComparison] = useState(false)
  const [showSecurityAnalysis, setShowSecurityAnalysis] = useState(false)
  const [comparisonData, setComparisonData] = useState<{
    originalArchitecture: Architecture;
    optimizedArchitecture: Architecture;
    recommendations: any[];
    totalSavings: number;
    savingsPercentage: number;
  } | null>(null)

  // Load initial architecture from props, navigation state, or context
  useEffect(() => {
    const architecture = 
      initialArchitecture || 
      (location.state as { architecture?: Architecture })?.architecture ||
      contextArchitecture
    
    if (architecture) {
      loadArchitecture(architecture)
    } else {
      // Check for auto-save recovery
      const autosaved = diagramService.loadFromLocalStorage()
      if (autosaved) {
        setShowRecoveryPrompt(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArchitecture, location.state])

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) {
      return
    }

    autoSaveIntervalRef.current = window.setInterval(() => {
      const architecture = exportArchitecture()
      diagramService.saveToLocalStorage(architecture, currentDiagramName)
    }, 30000) // 30 seconds

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [nodes, edges, currentDiagramName]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + L for auto-layout
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        event.preventDefault()
        handleAutoLayout()
      }
      // Delete key for selected node
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNode && document.activeElement?.tagName !== 'INPUT') {
          event.preventDefault()
          deleteNode()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track that we have changes
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      hasChangesRef.current = true
    }
  }, [nodes, edges])

  // Save to context when unmounting if we have changes
  useEffect(() => {
    return () => {
      if (hasChangesRef.current) {
        const services: AWSService[] = nodes.map((node) => ({
          id: node.id,
          type: node.data.serviceType as string,
          name: node.data.name as string,
          configuration: node.data.configuration as Record<string, unknown>,
          position: node.position,
        }))

        const connections: ServiceConnection[] = edges.map((edge) => ({
          id: edge.id,
          sourceId: edge.source,
          targetId: edge.target,
          type: edge.animated ? 'async' : 'sync',
          protocol: edge.label as string | undefined,
        }))

        const architecture: Architecture = {
          services,
          connections,
          metadata: {
            name: currentDiagramName || 'Untitled Architecture',
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }
        
        setContextArchitecture(architecture)
      }
    }
  }, [nodes, edges, currentDiagramName, setContextArchitecture])

  const loadArchitecture = useCallback((architecture: Architecture) => {
    // Helper function to get config summary for any service
    const getServiceConfigSummary = (service: any): string => {
      const config = service.configuration || {};
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
        if (config.instanceClass && typeof config.instanceClass === 'string') parts.push(config.instanceClass);
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
    };
    
    // Convert Architecture services to React Flow nodes
    const newNodes: Node[] = architecture.services.map((service) => {
      const ServiceIcon = getServiceIcon(service.type)
      const color = getServiceColor(service.type)
      const config = service.configuration || {};
      const isOptimized = config.optimized === true;
      const configSummary = getServiceConfigSummary(service);
      
      return {
        id: service.id,
        type: 'default',
        position: service.position,
        data: {
          label: (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}>
              <ServiceIcon size={24} />
              <div style={{ fontSize: '10px', fontWeight: '600', textAlign: 'center', lineHeight: 1.2 }}>
                {service.name}
              </div>
              {configSummary && (
                <div style={{ fontSize: '8px', opacity: 0.85, fontWeight: '500', textAlign: 'center', lineHeight: 1.2, maxWidth: '150px' }}>
                  {configSummary}
                </div>
              )}
              {isOptimized && (
                <div style={{ fontSize: '7px', background: 'rgba(16, 185, 129, 0.3)', padding: '2px 6px', borderRadius: '8px', color: '#10b981', fontWeight: 'bold', marginTop: '2px' }}>
                  ✓ Optimized
                </div>
              )}
            </div>
          ),
          name: service.name, // Store actual name as string
          serviceType: service.type,
          configuration: service.configuration,
        },
        style: {
          background: isOptimized ? '#10b981' : color,
          color: 'white',
          border: isOptimized ? '3px solid #059669' : '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '10px',
          fontWeight: '600',
          minWidth: '140px',
          maxWidth: '200px',
          textAlign: 'center',
          boxShadow: isOptimized ? '0 0 20px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
        },
      }
    })

    // Convert connections to React Flow edges with validation
    const newEdges: Edge[] = architecture.connections.map((conn) => {
      const sourceNode = architecture.services.find((s) => s.id === conn.sourceId)
      const targetNode = architecture.services.find((s) => s.id === conn.targetId)
      
      const sourceType = sourceNode?.type || ''
      const targetType = targetNode?.type || ''
      
      const validation = validateConnection(sourceType, targetType)
      const connType = conn.type || getConnectionType(sourceType, targetType)
      const protocol = conn.protocol || getConnectionProtocol(sourceType, targetType)

      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        type: 'custom',
        animated: connType === 'async',
        data: {
          sourceType,
          targetType,
          connectionType: connType,
          protocol,
          isValid: validation.allowed,
          reason: validation.reason,
        },
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)
    
    // Set the architecture name if available
    if (architecture.metadata.name) {
      setCurrentDiagramName(architecture.metadata.name)
    }
  }, [setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return

      // Find source and target nodes
      const sourceNode = nodes.find((n) => n.id === params.source)
      const targetNode = nodes.find((n) => n.id === params.target)

      if (!sourceNode || !targetNode) return

      const sourceType = sourceNode.data.serviceType as string
      const targetType = targetNode.data.serviceType as string

      // Validate connection
      const validation = validateConnection(sourceType, targetType)
      const connType = getConnectionType(sourceType, targetType)
      const protocol = getConnectionProtocol(sourceType, targetType)

      // Create new edge with validation data
      const newEdge: Edge = {
        id: `${params.source}-${params.target}-${Date.now()}`,
        source: params.source,
        target: params.target,
        type: 'custom',
        animated: connType === 'async',
        data: {
          sourceType,
          targetType,
          connectionType: connType,
          protocol,
          isValid: validation.allowed,
          reason: validation.reason,
        },
      }

      setEdges((eds) => addEdge(newEdge, eds))

      // Show warning for invalid connections
      if (!validation.allowed) {
        setTimeout(() => {
          alert(`Warning: ${validation.reason}\n\nThis connection may not work in a real AWS environment.`)
        }, 100)
      }
    },
    [nodes, setEdges]
  )

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const serviceType = event.dataTransfer.getData('application/reactflow')
      if (!serviceType) return

      // Convert screen coordinates to React Flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const service = AWS_SERVICES.find((s) => s.type === serviceType)
      if (!service) return

      const ServiceIcon = service.icon

      const newNode: Node = {
        id: `${serviceType}-${Date.now()}`,
        type: 'default',
        position,
        data: {
          label: formatNodeLabel(serviceType, ServiceIcon),
          name: serviceType, // Store actual name as string
          serviceType: serviceType,
          configuration: {},
        },
        style: {
          background: service.color,
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '10px',
          fontWeight: '600',
          minWidth: '100px',
          maxWidth: '160px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes]
  )

  const onDragStart = (event: React.DragEvent, serviceType: string) => {
    event.dataTransfer.setData('application/reactflow', serviceType)
    event.dataTransfer.effectAllowed = 'move'
  }

  const deleteNode = useCallback(() => {
    if (!selectedNode) return

    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }, [selectedNode, setNodes, setEdges])

  const updateNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, configuration: config } } : n))
      )
    },
    [setNodes]
  )

  const updateNodeName = useCallback(
    (nodeId: string, name: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            const ServiceIcon = getServiceIcon(n.data.serviceType as string)
            return {
              ...n,
              data: {
                ...n.data,
                label: formatNodeLabel(name, ServiceIcon),
                name: name, // Update string name for display/export
              },
            }
          }
          return n
        })
      )
    },
    [setNodes]
  )

  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = detectAndApplyLayout(nodes, edges)
    setNodes(layoutedNodes)
    
    // Fit view after layout with animation
    setTimeout(() => {
      fitView({ duration: 300, padding: 0.1 })
    }, 50)
  }, [nodes, edges, setNodes, fitView])

  const exportArchitecture = useCallback((): Architecture => {
    const services: AWSService[] = nodes.map((node) => ({
      id: node.id,
      type: node.data.serviceType as string,
      name: node.data.name as string, // Use string name, not React component
      configuration: node.data.configuration as Record<string, unknown>,
      position: node.position,
    }))

    const connections: ServiceConnection[] = edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.source,
      targetId: edge.target,
      type: edge.animated ? 'async' : 'sync',
      protocol: edge.label as string | undefined,
    }))

    return {
      services,
      connections,
      metadata: {
        name: currentDiagramName || 'Untitled Architecture',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  }, [nodes, edges, currentDiagramName])

  const handleSaveDiagram = async (name: string, changeDescription?: string) => {
    const architecture = exportArchitecture()
    const accessToken = TokenStorage.getIdToken()

    if (!accessToken) {
      alert('Please sign in to save diagrams')
      setShowSaveDialog(false)
      return
    }

    try {
      const result = await diagramService.saveDiagram(
        {
          diagramId: currentDiagramId || undefined,
          name,
          architecture,
          changeDescription,
        },
        accessToken
      )

      setCurrentDiagramId(result.diagramId)
      setCurrentDiagramName(name)
      setShowSaveDialog(false)
      
      // Clear auto-save since we just saved to server
      diagramService.clearLocalStorage()

      alert(result.message)
    } catch (error) {
      throw error // Let dialog handle the error
    }
  }

  const handleLoadDiagram = async (diagramId: string, _name: string) => {
    try {
      const result = await diagramService.getDiagram(diagramId)
      
      loadArchitecture(result.architecture)
      setCurrentDiagramId(result.diagramId)
      setCurrentDiagramName(result.name)
      setShowLoadDialog(false)

      // Clear auto-save since we just loaded a saved diagram
      diagramService.clearLocalStorage()
    } catch (error) {
      throw error // Let dialog handle the error
    }
  }

  const handleRecoverAutosave = () => {
    const autosaved = diagramService.loadFromLocalStorage()
    if (autosaved) {
      loadArchitecture(autosaved.architecture)
      setCurrentDiagramName(autosaved.name)
      setShowRecoveryPrompt(false)
    }
  }

  const handleDiscardAutosave = () => {
    diagramService.clearLocalStorage()
    setShowRecoveryPrompt(false)
  }

  const handleShowComparison = useCallback((
    originalArchitecture: Architecture,
    optimizedArchitecture: Architecture,
    recommendations: any[],
    totalSavings: number,
    savingsPercentage: number
  ) => {
    setComparisonData({
      originalArchitecture,
      optimizedArchitecture,
      recommendations,
      totalSavings,
      savingsPercentage,
    })
    setShowCostComparison(true)
  }, [])

  const handleApplyFromComparison = useCallback(() => {
    if (comparisonData) {
      loadArchitecture(comparisonData.optimizedArchitecture)
      setShowCostComparison(false)
      setComparisonData(null)
    }
  }, [comparisonData, loadArchitecture])

  const handleApplySecurityFixes = useCallback((findings: any[]) => {
    const updatedArchitecture = { ...exportArchitecture() }
    
    // Apply security fixes to services
    findings.forEach((finding) => {
      if (finding.autoFixable && finding.changes) {
        const service = updatedArchitecture.services.find((s) => s.id === finding.serviceId)
        if (service) {
          // Merge security fix configuration
          service.configuration = {
            ...service.configuration,
            ...finding.changes.configuration,
          }
        }
      }
    })
    
    // Reload architecture with security fixes applied
    loadArchitecture(updatedArchitecture)
  }, [exportArchitecture, loadArchitecture])

  return (
    <>
      <Navbar />
      <div className="visual-editor-page">{/* ... existing code ... */}
        {/* Service Palette */}
        <div className={`service-palette ${isPaletteCollapsed ? 'collapsed' : ''}`}>
          <h3>AWS Services</h3>
          {!isPaletteCollapsed && <p className="palette-hint">Drag services to canvas</p>}
          <button className="palette-toggle" onClick={() => setIsPaletteCollapsed(!isPaletteCollapsed)} title={isPaletteCollapsed ? 'Expand palette' : 'Collapse palette'}>
            {isPaletteCollapsed ? '▶' : '◀'}
          </button>
          <div className="service-list">
            {AWS_SERVICES.map((service) => {
              const ServiceIcon = service.icon
              return (
                <div
                  key={service.type}
                  className="service-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, service.type)}
                  style={{ borderLeft: `4px solid ${service.color}` }}
                  title={service.displayName || service.type}
                >
                  <span className="service-icon">
                    <ServiceIcon size={36} />
                  </span>
                  <span className="service-name">{service.displayName || service.type}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="editor-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            edgeTypes={edgeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap zoomable pannable />
          </ReactFlow>
        </div>

        {/* Configuration Panel */}
        {selectedNode && (
          <div className="config-panel">
            <div className="panel-header">
              <h3>Service Configuration</h3>
              <button className="btn-close" onClick={() => setSelectedNode(null)}>
                ×
              </button>
            </div>
            <div className="panel-content">
              <ServiceConfigForm
                node={selectedNode}
                onConfigChange={updateNodeConfig}
                onNameChange={updateNodeName}
              />
              <button className="btn-danger" onClick={deleteNode}>
                Delete Service
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="editor-toolbar">
          <button 
            onClick={handleAutoLayout} 
            title="Auto-arrange nodes (Ctrl/Cmd + L)"
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: '1px solid #444',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#2a2a2a',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">⚡</span> Auto-Layout
          </button>
          <button 
            onClick={() => setShowLoadDialog(true)} 
            title="Load saved diagram"
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: '1px solid #444',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#2a2a2a',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">📂</span> Load
          </button>
          <button 
            onClick={() => setShowSaveDialog(true)} 
            title="Save diagram to cloud"
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: 'none',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#0969da',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">💾</span> Save
          </button>
          <button 
            onClick={() => setShowCloudFormationPreview(true)} 
            title="Generate and view CloudFormation template"
            disabled={nodes.length === 0}
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: '1px solid #444',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#2a2a2a',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: nodes.length === 0 ? 0.5 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">☁️</span> CloudFormation
          </button>
          <button 
            onClick={() => setShowCostOptimization(true)} 
            title="Estimate costs and get AI-powered optimization recommendations"
            disabled={nodes.length === 0}
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: '1px solid #444',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#2a2a2a',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: nodes.length === 0 ? 0.5 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">💰</span> Optimize Costs
          </button>
          <button 
            onClick={() => setShowSecurityAnalysis(true)} 
            title="Analyze security vulnerabilities and get remediation recommendations"
            disabled={nodes.length === 0}
            style={{
              height: '48px',
              minHeight: '48px',
              maxHeight: '48px',
              padding: '0 20px',
              border: '1px solid #444',
              borderRadius: '6px',
              boxSizing: 'border-box',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              lineHeight: '1',
              margin: '0',
              background: '#2a2a2a',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: nodes.length === 0 ? 'not-allowed' : 'pointer',
              opacity: nodes.length === 0 ? 0.5 : 1,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="icon">🛡️</span> Security Review
          </button>
        </div>

        {/* Dialogs */}
        {showSaveDialog && (
          <SaveDiagramDialog
            currentName={currentDiagramId ? currentDiagramName : undefined}
            onSave={handleSaveDiagram}
            onCancel={() => setShowSaveDialog(false)}
          />
        )}

        {showLoadDialog && (
          <LoadDiagramDialog
            onLoad={handleLoadDiagram}
            onCancel={() => setShowLoadDialog(false)}
          />
        )}

        {showRecoveryPrompt && (
          <div className="dialog-overlay">
            <div className="dialog-content">
              <div className="dialog-header">
                <h3>Recover Unsaved Changes?</h3>
              </div>
              <div className="dialog-body">
                <p>
                  We found an auto-saved diagram from your last session. Would you like to recover it?
                </p>
              </div>
              <div className="dialog-footer">
                <button className="btn btn-secondary" onClick={handleDiscardAutosave}>
                  Discard
                </button>
                <button className="btn btn-primary" onClick={handleRecoverAutosave}>
                  Recover
                </button>
              </div>
            </div>
          </div>
        )}

        {showCloudFormationPreview && (
          <CloudFormationPreview
            architecture={exportArchitecture()}
            onClose={() => setShowCloudFormationPreview(false)}
          />
        )}

        {showCostOptimization && (
          <CostOptimizationPanel
            architecture={exportArchitecture()}
            onShowComparison={handleShowComparison}
            onClose={() => setShowCostOptimization(false)}
          />
        )}

        {showCostComparison && comparisonData && (
          <CostComparisonView
            originalArchitecture={comparisonData.originalArchitecture}
            optimizedArchitecture={comparisonData.optimizedArchitecture}
            recommendations={comparisonData.recommendations}
            totalSavings={comparisonData.totalSavings}
            savingsPercentage={comparisonData.savingsPercentage}
            onApply={handleApplyFromComparison}
            onClose={() => {
              setShowCostComparison(false)
              setComparisonData(null)
            }}
          />
        )}

        {showSecurityAnalysis && (
          <SecurityAnalysisPanel
            architecture={exportArchitecture()}
            onApplyFixes={handleApplySecurityFixes}
            onClose={() => setShowSecurityAnalysis(false)}
          />
        )}
      </div>
    </>
  )
}
