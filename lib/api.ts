/**
 * API client for the Ditto backend.
 */

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "http://localhost:8000"

async function fetchApi<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

// --- Types ---

export interface MemoryOut {
  id: string
  title: string
  content: string
  memory_type: string
  created_at: string
}

export interface MemoryCreate {
  title: string
  content: string
  memory_type: string
}

export interface RetrievedMemory {
  chunk_id: string
  memory_id: string
  content: string
}

export interface ChatResponse {
  response: string
  retrieved_memories: RetrievedMemory[]
  conversation_id?: string
  user_message_id?: string
  assistant_message_id?: string
}

export interface ConversationOut {
  id: string
  title: string
  created_at?: string
}

export interface MessageOut {
  id: string
  role: string
  content: string
  created_at?: string
}

// --- API functions ---

/** List all memories. */
export async function getMemories(): Promise<MemoryOut[]> {
  return fetchApi<MemoryOut[]>("/memory")
}

/** Create a new memory. Content is chunked, embedded, and stored. */
export async function addMemory(payload: MemoryCreate): Promise<MemoryOut> {
  return fetchApi<MemoryOut>("/memory", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

/** Send a chat message; returns twin response and retrieved memories. */
export async function sendChat(
  message: string,
  conversationId?: string | null
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      ...(conversationId ? { conversation_id: conversationId } : {}),
    }),
  })
}

/** List recent conversations from Supabase. */
export async function getConversations(): Promise<ConversationOut[]> {
  return fetchApi<ConversationOut[]>("/conversations")
}

/** Get messages for a conversation. */
export async function getConversationMessages(
  conversationId: string
): Promise<MessageOut[]> {
  return fetchApi<MessageOut[]>(`/conversations/${conversationId}/messages`)
}

/** Edit a user message and regenerate the assistant response. */
export async function editAndRegenerate(
  conversationId: string,
  messageId: string,
  newContent: string
): Promise<ChatResponse> {
  return fetchApi<ChatResponse>("/chat/edit", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      message_id: messageId,
      new_content: newContent,
    }),
  })
}

/** Delete a conversation and its messages. */
export async function deleteConversation(
  conversationId: string
): Promise<{ status: string }> {
  return fetchApi<{ status: string }>(
    `/conversations/${conversationId}`,
    { method: "DELETE" }
  )
}

/** Health check. */
export async function healthCheck(): Promise<{ status: string }> {
  return fetchApi<{ status: string }>("/health")
}

// --- Personality (BFI-10 / OCEAN) ---

export interface PersonalityProfileOut {
  openness: number
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
  created_at?: string
}

/** Get the latest personality profile, or null if none. */
export async function getPersonalityProfile(): Promise<PersonalityProfileOut | null> {
  return fetchApi<PersonalityProfileOut | null>("/personality")
}

/** Submit BFI-44 answers (44 integers 1-5) and save profile. */
export async function submitPersonalityTest(
  answers: number[]
): Promise<PersonalityProfileOut> {
  return fetchApi<PersonalityProfileOut>("/personality", {
    method: "POST",
    body: JSON.stringify({ answers }),
  })
}

// --- Interview Simulation ---

export interface InterviewSessionOut {
  id: string
  created_at: string
}

export interface InterviewQuestionOut {
  id: string
  session_id: string
  question_text: string
  created_at: string
}

export interface InterviewFeedbackResponse {
  answer_id: string
  feedback: string
  improved_answer: string
  retrieved_memory_count: number
}

export interface InterviewAnswerOut {
  id: string
  session_id: string
  question_id: string
  user_answer: string
  transcribed_text: string | null
  feedback: string | null
  improved_answer: string | null
  created_at: string
}

/** Create a new interview session. */
export async function createInterviewSession(): Promise<InterviewSessionOut> {
  return fetchApi<InterviewSessionOut>("/interview/sessions", { method: "POST" })
}

/** List all interview sessions. */
export async function getInterviewSessions(): Promise<InterviewSessionOut[]> {
  return fetchApi<InterviewSessionOut[]>("/interview/sessions")
}

/** Get questions for a session. */
export async function getInterviewQuestions(
  sessionId: string
): Promise<InterviewQuestionOut[]> {
  return fetchApi<InterviewQuestionOut[]>(
    `/interview/sessions/${sessionId}/questions`
  )
}

/** Generate interview questions from memories. */
export async function generateInterviewQuestions(
  sessionId: string,
  count?: number
): Promise<InterviewQuestionOut[]> {
  const qs = count != null ? `?count=${count}` : ""
  return fetchApi<InterviewQuestionOut[]>(
    `/interview/sessions/${sessionId}/questions/generate${qs}`,
    { method: "POST" }
  )
}

/** Add a custom interview question. */
export async function addInterviewQuestion(
  sessionId: string,
  questionText: string
): Promise<InterviewQuestionOut> {
  return fetchApi<InterviewQuestionOut>(
    `/interview/sessions/${sessionId}/questions`,
    {
      method: "POST",
      body: JSON.stringify({ question_text: questionText }),
    }
  )
}

/** Submit a text answer; returns feedback and improved answer. */
export async function submitInterviewAnswerText(
  sessionId: string,
  questionId: string,
  answerText: string
): Promise<InterviewFeedbackResponse> {
  return fetchApi<InterviewFeedbackResponse>(
    `/interview/sessions/${sessionId}/questions/${questionId}/answer`,
    {
      method: "POST",
      body: JSON.stringify({ answer_text: answerText }),
    }
  )
}

/** Submit an audio answer (multipart); returns feedback and improved answer. */
export async function submitInterviewAnswerSpeech(
  sessionId: string,
  questionId: string,
  audioFile: File
): Promise<InterviewFeedbackResponse> {
  const url = `${API_BASE}/interview/sessions/${sessionId}/questions/${questionId}/answer/speech`
  const form = new FormData()
  form.append("audio", audioFile)
  const res = await fetch(url, {
    method: "POST",
    body: form,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API error ${res.status}`)
  }
  return res.json() as Promise<InterviewFeedbackResponse>
}

/** Get a stored answer. */
export async function getInterviewAnswer(
  answerId: string
): Promise<InterviewAnswerOut> {
  return fetchApi<InterviewAnswerOut>(`/interview/answers/${answerId}`)
}

/** Get improved answer as audio (MP3). Returns blob URL or null if ElevenLabs not configured. */
export async function getInterviewImprovedAudio(
  answerId: string
): Promise<Blob> {
  const url = `${API_BASE}/interview/answers/${answerId}/improved-audio`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `API error ${res.status}`)
  }
  return res.blob()
}
