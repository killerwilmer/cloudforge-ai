import { Navbar } from '@/components/Navbar'
import { CustomEdge } from '@/components/visual-editor/CustomEdge'
import { ServiceConfigForm } from '@/components/visual-editor/ServiceConfigForm'
import type { Architecture, AWSService, ServiceConnection } from '@/types'
import { detectAndApplyLayout } from '@/utils/auto-layout'
import {
    getConnectionProtocol,
    getConnectionType,
    validateConnection,
} from '@/utils/connection-validator'
import { useCallback, useEffect, useState } from 'react'
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

// AWS Service types and their colors
const AWS_SERVICES = [
  { type: 'Lambda', color: '#FF9900', icon: 'λ' },
  { type: 'API Gateway', color: '#C925D1', icon: '🌐' },
  { type: 'DynamoDB', color: '#527FFF', icon: '📊' },
  { type: 'S3', color: '#569A31', icon: '🪣' },
  { type: 'Cognito', color: '#DD344C', icon: '👤' },
  { type: 'SQS', color: '#FF4F8B', icon: '📬' },
  { type: 'SNS', color: '#B7CA9D', icon: '📢' },
  { type: 'EventBridge', color: '#FF4F8B', icon: '🔀' },
  { type: 'RDS', color: '#527FFF', icon: '🗄️' },
  { type: 'CloudFront', color: '#8C4FFF', icon: '🌍' },
]

// Define custom edge types
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
}

interface VisualEditorPageProps {
  initialArchitecture?: Architecture
}

export function VisualEditorPage({ initialArchitecture }: VisualEditorPageProps) {
  const location = useLocation()
  const { fitView, screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)

  // Load initial architecture from props or navigation state
  useEffect(() => {
    const architecture = initialArchitecture || (location.state as { architecture?: Architecture })?.architecture
    if (architecture) {
      loadArchitecture(architecture)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArchitecture, location.state])

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

  const loadArchitecture = useCallback((architecture: Architecture) => {
    // Convert Architecture services to React Flow nodes
    const newNodes: Node[] = architecture.services.map((service) => ({
      id: service.id,
      type: 'default',
      position: service.position,
      data: {
        label: service.name,
        serviceType: service.type,
        configuration: service.configuration,
      },
      style: {
        background: AWS_SERVICES.find((s) => s.type === service.type)?.color || '#666',
        color: 'white',
        border: '2px solid #222',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        fontWeight: 'bold',
      },
    }))

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

      const newNode: Node = {
        id: `${serviceType}-${Date.now()}`,
        type: 'default',
        position,
        data: {
          label: `${service.icon} ${serviceType}`,
          serviceType: serviceType,
          configuration: {},
        },
        style: {
          background: service.color,
          color: 'white',
          border: '2px solid #222',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: 'bold',
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
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, label: name } } : n))
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
      name: node.data.label as string,
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
        name: 'Untitled Architecture',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  }, [nodes, edges])

  const handleExportJSON = useCallback(() => {
    const architecture = exportArchitecture()
    const jsonString = JSON.stringify(architecture, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `architecture-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [exportArchitecture])

  return (
    <>
      <Navbar />
      <div className="visual-editor-page">
        {/* Service Palette */}
        <div className="service-palette">
          <h3>AWS Services</h3>
          <p className="palette-hint">Drag services to canvas</p>
          <div className="service-list">
            {AWS_SERVICES.map((service) => (
              <div
                key={service.type}
                className="service-item"
                draggable
                onDragStart={(e) => onDragStart(e, service.type)}
                style={{ borderLeft: `4px solid ${service.color}` }}
              >
                <span className="service-icon">{service.icon}</span>
                <span className="service-name">{service.type}</span>
              </div>
            ))}
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
          <button className="btn-secondary" onClick={handleAutoLayout} title="Auto-arrange nodes (Ctrl/Cmd + L)">
            <span className="icon">⚡</span> Auto-Layout
          </button>
          <button className="btn-secondary" onClick={handleExportJSON} title="Download architecture as JSON file">
            <span className="icon">📥</span> Export JSON
          </button>
          <button className="btn-primary" onClick={() => alert('Save functionality coming soon!')}>
            Save Diagram
          </button>
        </div>
      </div>
    </>
  )
}
