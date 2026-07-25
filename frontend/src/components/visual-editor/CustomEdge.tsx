import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow'
import './CustomEdge.css'

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const isValid = data?.isValid !== false
  const connectionType = data?.connectionType as string
  const protocol = data?.protocol as string

  // Determine color based on protocol label
  const getEdgeColor = () => {
    if (!isValid) return '#da3633'
    
    // Assign colors based on protocol text
    if (protocol) {
      const protocolLower = protocol.toLowerCase()
      
      // Invoke actions - Blue
      if (protocolLower.includes('invoke') || protocolLower.includes('trigger')) {
        return '#0969da' // Blue
      }
      
      // Read/Write/Data operations - Green
      if (protocolLower.includes('read') || protocolLower.includes('write') || 
          protocolLower.includes('query') || protocolLower.includes('stream')) {
        return '#1f883d' // Green
      }
      
      // Publish/Send/Messages - Purple
      if (protocolLower.includes('publish') || protocolLower.includes('send') || 
          protocolLower.includes('poll')) {
        return '#8250df' // Purple
      }
      
      // Logs/Metrics/Watch - Orange
      if (protocolLower.includes('logs') || protocolLower.includes('metrics') || 
          protocolLower.includes('watch')) {
        return '#bf8700' // Orange
      }
      
      // Auth/Permissions/Role - Red
      if (protocolLower.includes('auth') || protocolLower.includes('permissions') || 
          protocolLower.includes('role') || protocolLower.includes('assume')) {
        return '#cf222e' // Red
      }
      
      // Direct/Origin/Connection - Cyan
      if (protocolLower.includes('direct') || protocolLower.includes('origin') || 
          protocolLower.includes('connection')) {
        return '#0969da' // Cyan-Blue
      }
    }
    
    // Fallback to connection type
    switch (connectionType) {
      case 'sync':
        return '#0969da' // Blue for synchronous
      case 'async':
        return '#8250df' // Purple for async
      case 'data':
        return '#1f883d' // Green for data
      default:
        return '#666'
    }
  }

  const edgeColor = getEdgeColor()

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: 2,
          opacity: isValid ? 1 : 0.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`custom-edge-label ${!isValid ? 'invalid' : ''}`}
        >
          {data?.protocol && data.protocol.trim() && (
            <div className="edge-protocol" style={{ background: edgeColor }}>
              {data.protocol}
            </div>
          )}
          {!isValid && data?.reason && (
            <div className="edge-error" title={data.reason}>
              ⚠️ Invalid
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
