"use client"

import { useState, useCallback, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  createInterviewSession,
  getInterviewQuestions,
  generateInterviewQuestions,
  addInterviewQuestion,
  submitInterviewAnswerText,
  submitInterviewAnswerSpeech,
  getInterviewImprovedAudio,
  type InterviewSessionOut,
  type InterviewQuestionOut,
  type InterviewFeedbackResponse,
} from "@/lib/api"
import { toast } from "sonner"
import {
  Mic,
  Send,
  Sparkles,
  Plus,
  Volume2,
  Loader2,
  MessageCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface InterviewPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InterviewPanel({ open, onOpenChange }: InterviewPanelProps) {
  const [session, setSession] = useState<InterviewSessionOut | null>(null)
  const [questions, setQuestions] = useState<InterviewQuestionOut[]>([])
  const [loadingSession, setLoadingSession] = useState(false)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [customQuestionText, setCustomQuestionText] = useState("")
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<InterviewFeedbackResponse | null>(null)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const fetchQuestions = useCallback(
    async (sid: string) => {
      setLoadingQuestions(true)
      try {
        const list = await getInterviewQuestions(sid)
        setQuestions(list)
      } catch (e) {
        toast.error("Failed to load questions", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      } finally {
        setLoadingQuestions(false)
      }
    },
    []
  )

  const handleStartSession = useCallback(async () => {
    setLoadingSession(true)
    setFeedback(null)
    setSelectedQuestionId(null)
    setAnswerText("")
    try {
      const s = await createInterviewSession()
      setSession(s)
      setQuestions([])
      toast.success("Session started", {
        description: "Add or generate questions to begin.",
      })
    } catch (e) {
      toast.error("Failed to start session", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoadingSession(false)
    }
  }, [])

  const handleGenerateQuestions = useCallback(async () => {
    if (!session) return
    setLoadingQuestions(true)
    try {
      const list = await generateInterviewQuestions(session.id, 5)
      setQuestions((prev) => [...prev, ...list])
      toast.success("Questions generated", {
        description: `Added ${list.length} questions from your memories.`,
      })
    } catch (e) {
      toast.error("Failed to generate questions", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setLoadingQuestions(false)
    }
  }, [session])

  const handleAddCustomQuestion = useCallback(async () => {
    if (!session || !customQuestionText.trim()) return
    setAddingQuestion(true)
    try {
      const q = await addInterviewQuestion(session.id, customQuestionText.trim())
      setQuestions((prev) => [...prev, q])
      setCustomQuestionText("")
      toast.success("Question added")
    } catch (e) {
      toast.error("Failed to add question", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setAddingQuestion(false)
    }
  }, [session, customQuestionText])

  const handleSubmitTextAnswer = useCallback(async () => {
    if (!session || !selectedQuestionId || !answerText.trim()) return
    setSubmitting(true)
    setFeedback(null)
    try {
      const result = await submitInterviewAnswerText(
        session.id,
        selectedQuestionId,
        answerText.trim()
      )
      setFeedback(result)
      toast.success("Feedback ready")
    } catch (e) {
      toast.error("Failed to submit answer", {
        description: e instanceof Error ? e.message : "Unknown error",
      })
    } finally {
      setSubmitting(false)
    }
  }, [session, selectedQuestionId, answerText])

  const handleSubmitSpeechAnswer = useCallback(
    async (audioBlob: Blob) => {
      if (!session || !selectedQuestionId) return
      setSubmitting(true)
      setFeedback(null)
      try {
        const file = new File([audioBlob], "answer.webm", {
          type: audioBlob.type,
        })
        const result = await submitInterviewAnswerSpeech(
          session.id,
          selectedQuestionId,
          file
        )
        setFeedback(result)
        setAnswerText("") // optional: could set transcribed text
        toast.success("Feedback ready")
      } catch (e) {
        toast.error("Failed to submit audio", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [session, selectedQuestionId]
  )

  const startRecording = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported")
      return
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" })
          handleSubmitSpeechAnswer(blob)
        }
      }
      mediaRecorderRef.current = mr
      mr.start()
      setRecording(true)
    })
  }, [handleSubmitSpeechAnswer])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
    setRecording(false)
  }, [])

  const handlePlayImproved = useCallback(async () => {
    if (!feedback?.answer_id) return
    setPlayingAudio(true)
    try {
      const blob = await getInterviewImprovedAudio(feedback.answer_id)
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setPlayingAudio(false)
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        setPlayingAudio(false)
      }
      await audio.play()
    } catch (e) {
      toast.error("Could not play audio", {
        description: e instanceof Error ? e.message : "ElevenLabs may not be configured.",
      })
      setPlayingAudio(false)
    }
  }, [feedback?.answer_id])

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-l sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Interview Mode
          </SheetTitle>
          <SheetDescription>
            Practice with questions from your memories. Answer by text or voice and get feedback plus an improved answer in your cloned voice.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {!session ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Start a new practice session. You can generate questions from your memory library or add your own.
                </p>
                <Button
                  onClick={handleStartSession}
                  disabled={loadingSession}
                  className="w-full"
                >
                  {loadingSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Start new session
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateQuestions}
                    disabled={loadingQuestions}
                  >
                    {loadingQuestions ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate from memories
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Add custom question</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Tell me about a time you led a project"
                      value={customQuestionText}
                      onChange={(e) => setCustomQuestionText(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleAddCustomQuestion()
                      }
                    />
                    <Button
                      variant="secondary"
                      onClick={handleAddCustomQuestion}
                      disabled={!customQuestionText.trim() || addingQuestion}
                    >
                      {addingQuestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {questions.length > 0 && (
                  <div className="space-y-2">
                    <Label>Questions</Label>
                    <div className="flex flex-col gap-1">
                      {questions.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setSelectedQuestionId(q.id)
                            setFeedback(null)
                            setAnswerText("")
                          }}
                          className={cn(
                            "rounded-lg border p-3 text-left text-sm transition-colors",
                            selectedQuestionId === q.id
                              ? "border-primary bg-secondary"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          {q.question_text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedQuestion && (
                  <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
                    <p className="font-medium text-foreground">
                      {selectedQuestion.question_text}
                    </p>
                    <div className="space-y-2">
                      <Label>Your answer (text or record below)</Label>
                      <Textarea
                        placeholder="Type your answer here..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        rows={4}
                        className="resize-none"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={handleSubmitTextAnswer}
                          disabled={!answerText.trim() || submitting}
                        >
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Submit text answer
                            </>
                          )}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={recording ? stopRecording : startRecording}
                          disabled={submitting}
                        >
                          {recording ? (
                            <>
                              <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-red-500" />
                              Stop & submit
                            </>
                          ) : (
                            <>
                              <Mic className="h-4 w-4" />
                              Answer by voice
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {feedback && (
                  <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <h4 className="font-medium">Feedback</h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {feedback.feedback}
                    </p>
                    <div>
                      <h4 className="mb-1 font-medium">Improved answer</h4>
                      <p className="whitespace-pre-wrap text-sm">
                        {feedback.improved_answer}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={handlePlayImproved}
                        disabled={playingAudio}
                      >
                        {playingAudio ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Volume2 className="h-4 w-4" />
                            Play in my voice
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
