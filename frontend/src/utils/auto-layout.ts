import type { Edge, Node } from 'reactflow'

/**
 * Auto-layout algorithm for AWS architecture diagrams
 * Uses a hierarchical flow layout (left-to-right)
 */

/**
 * Calculate the hierarchy level of each node based on connections
 * Level 0 = source nodes (no incoming connections)
 * Level N = nodes that depend on Level N-1 nodes
 */
function calculateNodeLevels(nodes: Node[], edges: Edge[]): Map<string, number> {
  const levels = new Map<string, number>()
  const incomingEdges = new Map<string, string[]>()
  const outgoingEdges = new Map<string, string[]>()

  // Build incoming/outgoing edge maps
  edges.forEach((edge) => {
    if (!incomingEdges.has(edge.target)) {
      incomingEdges.set(edge.target, [])
    }
    incomingEdges.get(edge.target)!.push(edge.source)

    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, [])
    }
    outgoingEdges.get(edge.source)!.push(edge.target)
  })

  // Find root nodes (no incoming edges)
  const rootNodes = nodes.filter((node) => !incomingEdges.has(node.id))

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = rootNodes.map((node) => ({
    id: node.id,
    level: 0,
  }))
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!

    if (visited.has(current.id)) {
      // If already visited, update level if current is higher
      const existingLevel = levels.get(current.id) || 0
      if (current.level > existingLevel) {
        levels.set(current.id, current.level)
      }
      continue
    }

    visited.add(current.id)
    levels.set(current.id, current.level)

    // Add children to queue
    const children = outgoingEdges.get(current.id) || []
    children.forEach((childId) => {
      queue.push({ id: childId, level: current.level + 1 })
    })
  }

  // Handle disconnected nodes (no edges)
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0)
    }
  })

  return levels
}

/**
 * Apply hierarchical layout to nodes
 */
export function applyAutoLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const levels = calculateNodeLevels(nodes, edges)

  // Group nodes by level
  const nodesByLevel = new Map<number, Node[]>()
  nodes.forEach((node) => {
    const level = levels.get(node.id) || 0
    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, [])
    }
    nodesByLevel.get(level)!.push(node)
  })

  // Layout configuration
  const HORIZONTAL_SPACING = 300
  const VERTICAL_SPACING = 150
  const START_X = 50
  const START_Y = 50

  // Position nodes
  const layoutedNodes: Node[] = []
  const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b)

  sortedLevels.forEach((level) => {
    const nodesInLevel = nodesByLevel.get(level) || []
    const levelHeight = nodesInLevel.length * VERTICAL_SPACING

    nodesInLevel.forEach((node, index) => {
      const x = START_X + level * HORIZONTAL_SPACING
      const y = START_Y + index * VERTICAL_SPACING - levelHeight / 2

      layoutedNodes.push({
        ...node,
        position: { x, y },
      })
    })
  })

  return layoutedNodes
}

/**
 * Apply a circular layout (useful for cyclic dependencies or small diagrams)
 */
export function applyCircularLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes

  const centerX = 400
  const centerY = 300
  const radius = Math.max(200, nodes.length * 30)

  return nodes.map((node, index) => {
    const angle = (index * 2 * Math.PI) / nodes.length
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)

    return {
      ...node,
      position: { x, y },
    }
  })
}

/**
 * Apply a grid layout (simple fallback for any diagram)
 */
export function applyGridLayout(nodes: Node[]): Node[] {
  if (nodes.length === 0) return nodes

  const COLUMNS = Math.ceil(Math.sqrt(nodes.length))
  const COLUMN_SPACING = 250
  const ROW_SPACING = 150
  const START_X = 50
  const START_Y = 50

  return nodes.map((node, index) => {
    const col = index % COLUMNS
    const row = Math.floor(index / COLUMNS)

    return {
      ...node,
      position: {
        x: START_X + col * COLUMN_SPACING,
        y: START_Y + row * ROW_SPACING,
      },
    }
  })
}

/**
 * Detect the best layout algorithm based on the diagram structure
 */
export function detectAndApplyLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  // If there are edges, try hierarchical layout
  if (edges.length > 0) {
    return applyAutoLayout(nodes, edges)
  }

  // For disconnected nodes, use grid layout
  if (nodes.length <= 20) {
    return applyCircularLayout(nodes)
  }

  return applyGridLayout(nodes)
}
