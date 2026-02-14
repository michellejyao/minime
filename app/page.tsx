"use client"

import { useState, useCallback, useEffect } from "react"
import { LeftSidebar } from "@/components/digital-twin/left-sidebar"
import { ChatPanel, type Message } from "@/components/digital-twin/chat-panel"
import { RightSidebar, type MemoryContext } from "@/components/digital-twin/right-sidebar"
import { TopBar } from "@/components/digital-twin/top-bar"
import { InterviewPanel } from "@/components/digital-twin/interview-panel"
import { getMemories, addMemory, sendChat, getConversations, getConversationMessages, deleteConversation, editAndRegenerate } from "@/lib/api"
import type { ConversationOut } from "@/lib/api"
import { toast } from "sonner"

/** Map API RetrievedMemory to MemoryContext for the right sidebar. */
function toMemoryContext(m: { chunk_id: string; memory_id: string; content: string }): MemoryContext {
  const title = m.content.length > 50 ? m.content.slice(0, 50).trim() + "…" : m.content.trim() || "Memory"
  return {
    id: m.chunk_id,
    title,
    type: "experience",
    preview: m.content,
  }
}

/** Map API MessageOut to ChatPanel Message. */
function toMessage(m: { id: string; role: string; content: string; created_at?: string }): Message {
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "twin",
    content: m.content,
    timestamp: m.created_at ? new Date(m.created_at) : new Date(),
  }
}

export default function DigitalTwinPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [memories, setMemories] = useState<{ id: string; title: string; type: string }[]>([])
  const [conversations, setConversations] = useState<ConversationOut[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [memoryContext, setMemoryContext] = useState<MemoryContext[]>([])
  const [isMemoryPanelOpen, setIsMemoryPanelOpen] = useState(true)
  const [interviewPanelOpen, setInterviewPanelOpen] = useState(false)

  const fetchConversations = useCallback(async () => {
    try {
      const list = await getConversations()
      setConversations(Array.isArray(list) ? list : [])
    } catch (err) {
      toast.error("Failed to load conversations", {
        description: err instanceof Error ? err.message : "Check that the backend is running.",
      })
    }
  }, [])

  const fetchMemories = useCallback(async () => {
    try {
      const list = await getMemories()
      setMemories(
        list.map((m) => ({ id: m.id, title: m.title, type: m.memory_type }))
      )
    } catch (err) {
      toast.error("Failed to load memories", {
        description: err instanceof Error ? err.message : "Check that the backend is running.",
      })
    }
  }, [])

  useEffect(() => {
    fetchMemories()
  }, [fetchMemories])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  const handleAddMemory = useCallback(
    async (payload: { title: string; content: string; memory_type: string }) => {
      await addMemory(payload)
      toast.success("Memory added", { description: `"${payload.title}" has been saved.` })
      fetchMemories()
    },
    [fetchMemories]
  )

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsTyping(true)
    setMemoryContext([])

    try {
      const { response: text, retrieved_memories, conversation_id, user_message_id, assistant_message_id } = await sendChat(
        content,
        activeConversation
      )
      const contexts = retrieved_memories.map(toMemoryContext)
      setMemoryContext(contexts)
      const twinMessage: Message = {
        id: assistant_message_id ?? `msg-${Date.now()}-twin`,
        role: "twin",
        content: text,
        timestamp: new Date(),
        memoryIds: contexts.map((m) => m.id),
      }
      setMessages((prev) => {
        const withTwin = [...prev, twinMessage]
        if (user_message_id && withTwin.length >= 2) {
          withTwin[withTwin.length - 2] = { ...withTwin[withTwin.length - 2], id: user_message_id }
        }
        return withTwin
      })
      if (conversation_id) {
        setActiveConversation(conversation_id)
        fetchConversations()
      }
    } catch (err) {
      toast.error("Chat failed", {
        description: err instanceof Error ? err.message : "Check that the backend is running.",
      })
      const fallbackMessage: Message = {
        id: `msg-${Date.now()}-twin`,
        role: "twin",
        content: "Sorry, I couldn't connect to the backend. Make sure the API is running on port 8000.",
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, fallbackMessage])
    } finally {
      setIsTyping(false)
    }
  }, [activeConversation, fetchConversations])

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setMemoryContext([])
    setActiveConversation(null)
  }, [])

  const handleSelectConversation = useCallback(async (id: string) => {
    setActiveConversation(id)
    setMemoryContext([])
    try {
      const msgs = await getConversationMessages(id)
      setMessages(msgs.map(toMessage))
    } catch (err) {
      toast.error("Failed to load conversation", {
        description: err instanceof Error ? err.message : "Check that the backend is running.",
      })
      setMessages([])
    }
  }, [])

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!activeConversation) return
      setIsTyping(true)
      setMemoryContext([])
      try {
        const { response: text, retrieved_memories, assistant_message_id } = await editAndRegenerate(
          activeConversation,
          messageId,
          newContent
        )
        const contexts = retrieved_memories.map(toMemoryContext)
        setMemoryContext(contexts)
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === messageId)
          if (idx < 0) return prev
          const keepUpToUser = prev.slice(0, idx)
          const updatedUser: Message = { ...prev[idx], content: newContent }
          const newTwin: Message = {
            id: assistant_message_id ?? `msg-${Date.now()}-twin`,
            role: "twin",
            content: text,
            timestamp: new Date(),
            memoryIds: contexts.map((m) => m.id),
          }
          return [...keepUpToUser, updatedUser, newTwin]
        })
        fetchConversations()
      } catch (err) {
        toast.error("Failed to edit message", {
          description: err instanceof Error ? err.message : "Check that the backend is running.",
        })
      } finally {
        setIsTyping(false)
      }
    },
    [activeConversation, fetchConversations]
  )

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await deleteConversation(id)
        toast.success("Conversation deleted")
        fetchConversations()
        if (activeConversation === id) {
          setMessages([])
          setMemoryContext([])
          setActiveConversation(null)
        }
      } catch (err) {
        toast.error("Failed to delete conversation", {
          description: err instanceof Error ? err.message : "Check that the backend is running.",
        })
      }
    },
    [activeConversation, fetchConversations]
  )

  const handlePersonalityComplete = useCallback(() => {
    toast.success("Personality profile saved", {
      description: "Your digital twin will now use this to better mirror you.",
    })
  }, [])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <LeftSidebar
        memories={memories}
        conversations={(conversations ?? []).map((c) => ({ id: c.id, title: c.title, date: c.created_at ?? "" }))}
        activeConversation={activeConversation}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onAddMemory={handleAddMemory}
        onPersonalityComplete={handlePersonalityComplete}
        onOpenInterview={() => setInterviewPanelOpen(true)}
      />

      <InterviewPanel
        open={interviewPanelOpen}
        onOpenChange={setInterviewPanelOpen}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          isMemoryPanelOpen={isMemoryPanelOpen}
          onToggleMemoryPanel={() => setIsMemoryPanelOpen(!isMemoryPanelOpen)}
          activeConversationId={activeConversation}
          onDeleteConversation={handleDeleteConversation}
        />

        <div className="flex flex-1 overflow-hidden">
          <ChatPanel
            messages={messages}
            onSendMessage={handleSendMessage}
            onEditMessage={activeConversation ? handleEditMessage : undefined}
            isTyping={isTyping}
          />

          {isMemoryPanelOpen && (
            <RightSidebar memories={memoryContext} isVisible={isMemoryPanelOpen} />
          )}
        </div>
      </div>
    </div>
  )
}
