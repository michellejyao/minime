"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MEMORY_TYPES = [
  { value: "experience", label: "Experience" },
  { value: "preference", label: "Preference" },
  { value: "fact", label: "Fact" },
  { value: "insight", label: "Insight" },
  { value: "event", label: "Event" },
  { value: "project", label: "Projects" },
]

interface AddMemoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: { title: string; content: string; memory_type: string; occurred_at?: string | null }) => Promise<void>
}

export function AddMemoryDialog({
  open,
  onOpenChange,
  onSubmit,
}: AddMemoryDialogProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [memoryType, setMemoryType] = useState("experience")
  const [occurredAt, setOccurredAt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!title.trim() || !content.trim()) {
      setError("Title and content are required.")
      return
    }
    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        memory_type: memoryType,
        occurred_at: occurredAt.trim() || undefined,
      })
      setTitle("")
      setContent("")
      setMemoryType("experience")
      setOccurredAt("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add memory.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setError(null)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Add Memory</DialogTitle>
          <DialogDescription>
            Add an experience, event, or memory. It will be chunked, embedded, and stored for your digital twin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g. Summer trip to the coast"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={512}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Describe what happened, what you learned, or what you want to remember..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={memoryType} onValueChange={setMemoryType}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {MEMORY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="occurred_at">When it happened (optional)</Label>
            <Input
              id="occurred_at"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Add a date so Ditto can answer questions like &quot;what happened last week?&quot;
            </p>
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Add memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
