"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Plus,
  MessageSquare,
  Settings,
  BookOpen,
  Mic,
  ChevronDown,
  ChevronRight,
  PenSquare,
  Brain,
  MoreHorizontal,
  Trash2,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { AddMemoryDialog } from "@/components/digital-twin/add-memory-dialog"
import { PersonalityTestDialog } from "@/components/digital-twin/personality-test-dialog"

interface Memory {
  id: string
  title: string
  type: string
}

interface Conversation {
  id: string
  title: string
  date: string
}

interface LeftSidebarProps {
  memories: Memory[]
  conversations: Conversation[]
  activeConversation: string | null
  onNewConversation: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation?: (id: string) => void
  onAddMemory?: (payload: { title: string; content: string; memory_type: string; occurred_at?: string | null }) => Promise<void>
  onPersonalityComplete?: () => void
  onOpenInterview?: () => void
}

export function LeftSidebar({
  memories,
  conversations,
  activeConversation,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onAddMemory,
  onPersonalityComplete,
  onOpenInterview,
}: LeftSidebarProps) {
  const [memoryExpanded, setMemoryExpanded] = useState(true)
  const [addMemoryOpen, setAddMemoryOpen] = useState(false)
  const [personalityTestOpen, setPersonalityTestOpen] = useState(false)

  return (
    <aside className="flex h-full w-[280px] flex-col border-r border-border bg-card">
      {/* App Title */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center -mt-1.5">
          <Image src="/dittopokemon.png" alt="Ditto" width={32} height={32} className="object-contain" />
        </div>
        <span className="text-base font-semibold text-foreground">Ditto</span>
      </div>

      {/* New Conversation */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewConversation}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary"
        >
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span>New conversation</span>
        </button>
      </div>

      <ScrollArea className="flex-1 px-3">
        {/* Recent Conversations */}
        <div className="pb-4">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          <div className="flex flex-col gap-0.5">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  activeConversation === conv.id
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <button
                  onClick={() => onSelectConversation(conv.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </button>
                {onDeleteConversation && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label="Conversation options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteConversation(conv.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Memory Library */}
        <div className="pb-4">
          <div className="sticky top-0 z-10 flex items-center justify-between bg-card px-2 pb-2 pt-0.5">
            <button
              onClick={() => setMemoryExpanded(!memoryExpanded)}
              className="flex min-w-0 shrink items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {memoryExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Memory Library
            </button>
            {onAddMemory && (
              <button
                onClick={() => setAddMemoryOpen(true)}
                className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                title="Add memory"
                aria-label="Add memory"
              >
                <PenSquare className="h-4 w-4" />
              </button>
            )}
          </div>
          {memoryExpanded && (
            <div className="flex flex-col gap-0.5">
              {memories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm">{memory.title}</span>
                    <span className="text-xs text-muted-foreground">{memory.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {onAddMemory && (
        <AddMemoryDialog
          open={addMemoryOpen}
          onOpenChange={setAddMemoryOpen}
          onSubmit={onAddMemory}
        />
      )}

      <PersonalityTestDialog
        open={personalityTestOpen}
        onOpenChange={setPersonalityTestOpen}
        onComplete={onPersonalityComplete}
      />

      {/* Bottom Actions */}
      <div className="flex flex-col gap-0.5 border-t border-border p-3">
        {onAddMemory && (
          <button
            onClick={() => setAddMemoryOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <PenSquare className="h-4 w-4" />
            <span>Add memory</span>
          </button>
        )}
        <button
          onClick={() => setPersonalityTestOpen(true)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Brain className="h-4 w-4" />
          <span>Personality Test (BFI-44)</span>
        </button>
        <button
          onClick={() => onOpenInterview?.()}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Mic className="h-4 w-4" />
          <span>Interview Mode</span>
        </button>
        <button className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  )
}
