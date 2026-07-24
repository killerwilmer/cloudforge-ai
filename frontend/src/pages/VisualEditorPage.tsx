import { Navbar } from '@/components/Navbar'
import type { Architecture, AWSService, ServiceConnection } from '@/types'
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
    type Connection,
    type Edge,
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

interface VisualEditorPageProps {
  initialArchitecture?: Architecture
}

export function VisualEditorPage({ initialArchitecture }: VisualEditorPageProps) {
  const location = useLocation()
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

    // Convert connections to React Flow edges
    const newEdges: Edge[] = architecture.connections.map((conn) => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      type: conn.type === 'sync' ? 'default' : 'step',
      animated: conn.type === 'async',
      style: { stroke: '#555', strokeWidth: 2 },
      label: conn.protocol || undefined,
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [setNodes, setEdges])

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))
    },
    [setEdges]
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

      const position = {
        x: event.clientX - 250,
        y: event.clientY - 100,
      }

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
    [setNodes]
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
              <div className="form-group">
                <label>Service Type</label>
                <input
                  type="text"
                  value={selectedNode.data.serviceType as string}
                  disabled
                  className="input-disabled"
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={selectedNode.data.label as string}
                  onChange={(e) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === selectedNode.id
                          ? { ...n, data: { ...n.data, label: e.target.value } }
                          : n
                      )
                    )
                  }}
                />
              </div>
              <button className="btn-danger" onClick={deleteNode}>
                Delete Service
              </button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="editor-toolbar">
          <button className="btn-secondary" onClick={() => console.log(exportArchitecture())}>
            Export JSON
          </button>
          <button className="btn-primary" onClick={() => alert('Save functionality coming soon!')}>
            Save Diagram
          </button>
        </div>
      </div>
    </>
  )
}
