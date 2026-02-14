"use client"

import { Settings, PanelRight, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopBarProps {
  isMemoryPanelOpen: boolean
  onToggleMemoryPanel: () => void
  activeConversationId?: string | null
  onDeleteConversation?: (id: string) => void
}

export function TopBar({ isMemoryPanelOpen, onToggleMemoryPanel, activeConversationId, onDeleteConversation }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card/80 px-5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-foreground">Ditto</h1>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Online</span>
        </div>
        {activeConversationId && onDeleteConversation && (
          <button
            onClick={() => onDeleteConversation(activeConversationId)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleMemoryPanel}
          className={cn(
            "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            isMemoryPanelOpen && "bg-secondary text-foreground"
          )}
          aria-label="Toggle memory context panel"
        >
          <PanelRight className="h-4 w-4" />
        </button>
        <button
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
