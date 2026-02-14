"use client"

import { BookOpen, Tag, FileText, Lightbulb, Calendar, FolderKanban } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface MemoryContext {
  id: string
  title: string
  type: "experience" | "preference" | "fact" | "insight" | "event" | "project"
  preview: string
}

interface RightSidebarProps {
  memories: MemoryContext[]
  isVisible: boolean
}

const typeConfig = {
  experience: {
    icon: BookOpen,
    label: "Experience",
    color: "text-blue-600 bg-blue-50",
  },
  preference: {
    icon: Tag,
    label: "Preference",
    color: "text-emerald-600 bg-emerald-50",
  },
  fact: {
    icon: FileText,
    label: "Fact",
    color: "text-amber-600 bg-amber-50",
  },
  insight: {
    icon: Lightbulb,
    label: "Insight",
    color: "text-violet-600 bg-violet-50",
  },
  event: {
    icon: Calendar,
    label: "Event",
    color: "text-orange-600 bg-orange-50",
  },
  project: {
    icon: FolderKanban,
    label: "Projects",
    color: "text-cyan-600 bg-cyan-50",
  },
}

export function RightSidebar({ memories, isVisible }: RightSidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-[300px] flex-col border-l border-border bg-card transition-all duration-300",
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground">Memory Context</h2>
        {memories.length > 0 && (
          <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {memories.length}
          </span>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4">
          {memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary mb-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center px-4">
                Memories retrieved for the current response will appear here
              </p>
            </div>
          ) : (
            memories.map((memory, index) => {
              const config = typeConfig[memory.type]
              const Icon = config.icon
              return (
                <div
                  key={memory.id}
                  className="animate-fade-in-up rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className={cn("flex h-6 w-6 items-center justify-center rounded-md", config.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                  </div>
                  <h3 className="mb-1 text-sm font-medium text-foreground">{memory.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {memory.preview}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
