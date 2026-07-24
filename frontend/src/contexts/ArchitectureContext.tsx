import type { Architecture } from '@/types'
import { createContext, useContext, useState, type ReactNode } from 'react'

interface ArchitectureContextType {
  architecture: Architecture | null
  setArchitecture: (architecture: Architecture | null) => void
  clearArchitecture: () => void
}

const ArchitectureContext = createContext<ArchitectureContextType | undefined>(
  undefined
)

export function ArchitectureProvider({ children }: { children: ReactNode }) {
  const [architecture, setArchitecture] = useState<Architecture | null>(null)

  const clearArchitecture = () => {
    setArchitecture(null)
  }

  return (
    <ArchitectureContext.Provider
      value={{ architecture, setArchitecture, clearArchitecture }}
    >
      {children}
    </ArchitectureContext.Provider>
  )
}

export function useArchitecture() {
  const context = useContext(ArchitectureContext)
  if (context === undefined) {
    throw new Error(
      'useArchitecture must be used within an ArchitectureProvider'
    )
  }
  return context
}
