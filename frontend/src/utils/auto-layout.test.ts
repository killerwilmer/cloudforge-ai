import type { Edge, Node } from 'reactflow'
import { describe, expect, it } from 'vitest'
import {
  applyAutoLayout,
  applyCircularLayout,
  applyGridLayout,
  detectAndApplyLayout,
} from './auto-layout'

describe('auto-layout', () => {
  describe('applyAutoLayout', () => {
    it('should return empty array for no nodes', () => {
      const result = applyAutoLayout([], [])
      expect(result).toEqual([])
    })

    it('should arrange nodes in hierarchical levels', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]
      const edges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e2-3', source: '2', target: '3' },
      ]

      const result = applyAutoLayout(nodes, edges)

      expect(result).toHaveLength(3)
      // Node 1 should be at level 0 (leftmost)
      expect(result[0].position.x).toBeLessThan(result[1].position.x)
      // Node 2 should be at level 1
      expect(result[1].position.x).toBeLessThan(result[2].position.x)
      // Node 3 should be at level 2 (rightmost)
    })

    it('should handle disconnected nodes', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]
      const edges: Edge[] = []

      const result = applyAutoLayout(nodes, edges)

      expect(result).toHaveLength(2)
      // Both nodes should be at level 0
      expect(result[0].position.x).toBe(result[1].position.x)
    })

    it('should handle parallel branches', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]
      const edges: Edge[] = [
        { id: 'e1-2', source: '1', target: '2' },
        { id: 'e1-3', source: '1', target: '3' },
      ]

      const result = applyAutoLayout(nodes, edges)

      expect(result).toHaveLength(3)
      // Node 1 should be at the left
      expect(result[0].position.x).toBeLessThan(result[1].position.x)
      // Nodes 2 and 3 should be at the same horizontal level
      expect(result[1].position.x).toBe(result[2].position.x)
    })
  })

  describe('applyCircularLayout', () => {
    it('should return empty array for no nodes', () => {
      const result = applyCircularLayout([])
      expect(result).toEqual([])
    })

    it('should arrange nodes in a circle', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '4', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]

      const result = applyCircularLayout(nodes)

      expect(result).toHaveLength(4)
      // All nodes should have different positions
      const positions = result.map((n) => `${n.position.x},${n.position.y}`)
      expect(new Set(positions).size).toBe(4)
    })

    it('should handle single node', () => {
      const nodes: Node[] = [{ id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} }]

      const result = applyCircularLayout(nodes)

      expect(result).toHaveLength(1)
      expect(result[0].position).toBeDefined()
    })
  })

  describe('applyGridLayout', () => {
    it('should return empty array for no nodes', () => {
      const result = applyGridLayout([])
      expect(result).toEqual([])
    })

    it('should arrange nodes in a grid', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '4', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]

      const result = applyGridLayout(nodes)

      expect(result).toHaveLength(4)
      // First two nodes should be in the same row
      expect(result[0].position.y).toBe(result[1].position.y)
      // First and third nodes should be in the same column
      expect(result[0].position.x).toBe(result[2].position.x)
    })

    it('should calculate correct number of columns', () => {
      const nodes: Node[] = Array.from({ length: 9 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {},
      }))

      const result = applyGridLayout(nodes)

      expect(result).toHaveLength(9)
      // Should arrange in 3 columns (sqrt(9) = 3)
      const firstRowNodes = result.filter((n) => n.position.y === result[0].position.y)
      expect(firstRowNodes).toHaveLength(3)
    })
  })

  describe('detectAndApplyLayout', () => {
    it('should return empty array for no nodes', () => {
      const result = detectAndApplyLayout([], [])
      expect(result).toEqual([])
    })

    it('should use hierarchical layout when edges exist', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]
      const edges: Edge[] = [{ id: 'e1-2', source: '1', target: '2' }]

      const result = detectAndApplyLayout(nodes, edges)

      expect(result).toHaveLength(2)
      // Should arrange hierarchically (left to right)
      expect(result[0].position.x).toBeLessThan(result[1].position.x)
    })

    it('should use circular layout for small diagrams without edges', () => {
      const nodes: Node[] = [
        { id: '1', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '2', type: 'default', position: { x: 0, y: 0 }, data: {} },
        { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} },
      ]

      const result = detectAndApplyLayout(nodes, [])

      expect(result).toHaveLength(3)
      // All nodes should have different positions
      const positions = result.map((n) => `${n.position.x},${n.position.y}`)
      expect(new Set(positions).size).toBe(3)
    })

    it('should use grid layout for large diagrams without edges', () => {
      const nodes: Node[] = Array.from({ length: 25 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'default',
        position: { x: 0, y: 0 },
        data: {},
      }))

      const result = detectAndApplyLayout(nodes, [])

      expect(result).toHaveLength(25)
      // Should use grid layout (more than 20 nodes)
      const yPositions = new Set(result.map((n) => n.position.y))
      expect(yPositions.size).toBeGreaterThan(1) // Multiple rows
    })
  })
})
