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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  createInterviewSession,
  generateInterviewQuestions,
  addInterviewQuestion,
  submitInterviewAnswerSpeech,
  type InterviewSessionOut,
  type InterviewQuestionOut,
  type InterviewFeedbackResponse,
  type InterviewVoiceOption,
} from "@/lib/api"
import { toast } from "sonner"
import {
  Mic,
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
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<InterviewFeedbackResponse | null>(null)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceOption, setVoiceOption] = useState<InterviewVoiceOption>("female")
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const improvedAudioRef = useRef<HTMLAudioElement | null>(null)

  const handleStartSession = useCallback(async () => {
    setLoadingSession(true)
    setFeedback(null)
    setSelectedQuestionId(null)
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
          file,
          voiceOption
        )
        setFeedback(result)
        toast.success("Feedback ready")
      } catch (e) {
        toast.error("Failed to submit audio", {
          description: e instanceof Error ? e.message : "Unknown error",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [session, selectedQuestionId, voiceOption]
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

  const handlePlayImproved = useCallback(() => {
    if (!feedback?.improved_audio_base64) return
    setPlayingAudio(true)
    try {
      // Strip whitespace/newlines that can come from JSON
      const base64 = feedback.improved_audio_base64.replace(/\s/g, "")
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: "audio/mpeg" })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      improvedAudioRef.current = audio
      const cleanup = () => {
        URL.revokeObjectURL(url)
        improvedAudioRef.current = null
        setPlayingAudio(false)
      }
      audio.onended = cleanup
      audio.onerror = () => {
        toast.error("Audio playback failed")
        cleanup()
      }
      audio.play()?.catch((e) => {
        toast.error("Could not play audio. Try clicking the button again.")
        cleanup()
      })
    } catch (e) {
      toast.error("Could not decode audio")
      setPlayingAudio(false)
    }
  }, [feedback?.improved_audio_base64])

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
            Practice with questions from your memories. Answer by voice only; your recording is used to clone your voice and read back the improved answer.
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
                      <Label>Hear improved answer in</Label>
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { value: "female" as const, label: "Female" },
                            { value: "male" as const, label: "Male" },
                            { value: "neutral" as const, label: "Gender neutral" },
                            { value: "clone" as const, label: "My cloned voice" },
                          ] as const
                        ).map(({ value, label }) => (
                          <Button
                            key={value}
                            type="button"
                            variant={voiceOption === value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setVoiceOption(value)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Answer by voice</Label>
                      <p className="text-xs text-muted-foreground">
                        Tap the button below, then speak your answer. The improved answer will be read back in the voice you chose above.
                      </p>
                      <Button
                        className="w-full"
                        onClick={recording ? stopRecording : startRecording}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Transcribing & analyzing…
                          </>
                        ) : recording ? (
                          <>
                            <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-red-500" />
                            Stop & submit
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4" />
                            Record answer
                          </>
                        )}
                      </Button>
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
                      {feedback.improved_audio_base64 ? (
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
                      ) : feedback.improved_audio_error ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Voice playback unavailable: {feedback.improved_audio_error}
                        </p>
                      ) : null}
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
