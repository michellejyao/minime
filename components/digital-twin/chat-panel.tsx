"use client"

import { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { Send, Paperclip, Pencil, Check } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "user" | "twin"
  content: string
  timestamp: Date
  memoryIds?: string[]
}

interface ChatPanelProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  isTyping: boolean
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function isPersistedMessageId(id: string): boolean {
  return id.length === 36 && id.includes("-")
}

export function ChatPanel({ messages, onSendMessage, onEditMessage, isTyping }: ChatPanelProps) {
  const [input, setInput] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [input])

  useEffect(() => {
    if (editingMessageId && editTextareaRef.current) {
      editTextareaRef.current.focus()
      editTextareaRef.current.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length
      )
    }
  }, [editingMessageId])

  const handleStartEdit = (msg: Message) => {
    setEditingMessageId(msg.id)
    setEditingContent(msg.content)
  }

  const handleSubmitEdit = () => {
    const content = editingContent.trim()
    if (!editingMessageId || !content || !onEditMessage) return
    onEditMessage(editingMessageId, content)
    setEditingMessageId(null)
    setEditingContent("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    onSendMessage(input.trim())
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="mx-auto max-w-2xl px-6 py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pt-24 animate-fade-in">
              <div className="flex h-24 w-24 items-center justify-center mb-5">
                <Image
                  src="/dittopokemon.png"
                  alt="Ditto"
                  width={96}
                  height={96}
                  className="object-contain"
                />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Hello, I&apos;m your Ditto
              </h2>
              <p className="text-center text-sm leading-relaxed text-muted-foreground max-w-md">
                I remember our conversations and learn from them.
                Ask me anything, reflect on ideas, or explore your thoughts.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {messages.map((message, index) => {
              const isEditing = editingMessageId === message.id
              const canEdit =
                message.role === "user" &&
                onEditMessage &&
                isPersistedMessageId(message.id)

              return (
                <div
                  key={message.id}
                  className={cn(
                    "group flex animate-fade-in-up",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col rounded-2xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-card-foreground border border-border"
                    )}
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          ref={editTextareaRef}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSubmitEdit()
                            }
                            if (e.key === "Escape") {
                              setEditingMessageId(null)
                            }
                          }}
                          rows={3}
                          className="min-w-[240px] resize-none rounded-lg bg-primary-foreground/10 px-3 py-2 text-sm text-primary-foreground placeholder:text-primary-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary-foreground/40"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSubmitEdit}
                            disabled={!editingContent.trim()}
                            className="rounded-lg p-1.5 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/20 disabled:opacity-40"
                            aria-label="Save edit"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="text-xs text-primary-foreground/60 hover:text-primary-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs",
                              message.role === "user"
                                ? "text-primary-foreground/60"
                                : "text-muted-foreground"
                            )}
                          >
                            {formatTime(message.timestamp)}
                          </p>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleStartEdit(message)}
                              className="rounded p-1 text-primary-foreground/60 opacity-0 transition-opacity hover:bg-primary-foreground/20 hover:text-primary-foreground group-hover:opacity-100"
                              aria-label="Edit message"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {isTyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border bg-card/50 px-6 py-4">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
          <div
            className={cn(
              "flex items-end gap-3 rounded-2xl border bg-card px-4 py-3 transition-all",
              isFocused
                ? "border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
                : "border-border"
            )}
          >
            <button
              type="button"
              className="mb-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder="Talk to Ditto..."
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className={cn(
                "mb-0.5 shrink-0 rounded-lg p-1.5 transition-colors",
                input.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground/40"
              )}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
