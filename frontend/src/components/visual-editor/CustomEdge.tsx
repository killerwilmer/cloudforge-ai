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

  // Determine edge color based on connection type
  const getEdgeColor = () => {
    if (!isValid) return '#da3633'
    
    switch (connectionType) {
      case 'sync':
        return '#0969da' // Blue for synchronous
      case 'async':
        return '#bf8700' // Orange for async
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
