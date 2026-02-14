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
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { submitPersonalityTest, type PersonalityProfileOut } from "@/lib/api"

const SCALE_LABELS = [
  "Disagree strongly",
  "Disagree a little",
  "Neither agree nor disagree",
  "Agree a little",
  "Agree strongly",
]

// BFI-44 items (John, Donahue, Kentle 1991) - full Big Five Inventory
const BFI_ITEMS: { text: string; trait: string }[] = [
  { text: "Is talkative", trait: "Extraversion" },
  { text: "Tends to find fault with others", trait: "Agreeableness" },
  { text: "Does a thorough job", trait: "Conscientiousness" },
  { text: "Is depressed, blue", trait: "Neuroticism" },
  { text: "Is original, comes up with new ideas", trait: "Openness" },
  { text: "Is reserved", trait: "Extraversion" },
  { text: "Is helpful and unselfish with others", trait: "Agreeableness" },
  { text: "Can be somewhat careless", trait: "Conscientiousness" },
  { text: "Is relaxed, handles stress well", trait: "Neuroticism" },
  { text: "Is curious about many different things", trait: "Openness" },
  { text: "Is full of energy", trait: "Extraversion" },
  { text: "Starts quarrels with others", trait: "Agreeableness" },
  { text: "Is a reliable worker", trait: "Conscientiousness" },
  { text: "Can be tense", trait: "Neuroticism" },
  { text: "Is ingenious, a deep thinker", trait: "Openness" },
  { text: "Generates a lot of enthusiasm", trait: "Extraversion" },
  { text: "Has a forgiving nature", trait: "Agreeableness" },
  { text: "Tends to be disorganized", trait: "Conscientiousness" },
  { text: "Worries a lot", trait: "Neuroticism" },
  { text: "Has an active imagination", trait: "Openness" },
  { text: "Tends to be quiet", trait: "Extraversion" },
  { text: "Is generally trusting", trait: "Agreeableness" },
  { text: "Tends to be lazy", trait: "Conscientiousness" },
  { text: "Is emotionally stable, not easily upset", trait: "Neuroticism" },
  { text: "Is inventive", trait: "Openness" },
  { text: "Has an assertive personality", trait: "Extraversion" },
  { text: "Can be cold and aloof", trait: "Agreeableness" },
  { text: "Perseveres until the task is finished", trait: "Conscientiousness" },
  { text: "Can be moody", trait: "Neuroticism" },
  { text: "Values artistic, aesthetic experiences", trait: "Openness" },
  { text: "Is sometimes shy, inhibited", trait: "Extraversion" },
  { text: "Is considerate and kind to almost everyone", trait: "Agreeableness" },
  { text: "Does things efficiently", trait: "Conscientiousness" },
  { text: "Remains calm in tense situations", trait: "Neuroticism" },
  { text: "Prefers work that is routine", trait: "Openness" },
  { text: "Is outgoing, sociable", trait: "Extraversion" },
  { text: "Is sometimes rude to others", trait: "Agreeableness" },
  { text: "Makes plans and follows through with them", trait: "Conscientiousness" },
  { text: "Gets nervous easily", trait: "Neuroticism" },
  { text: "Likes to reflect, play with ideas", trait: "Openness" },
  { text: "Has few artistic interests", trait: "Openness" },
  { text: "Likes to cooperate with others", trait: "Agreeableness" },
  { text: "Is easily distracted", trait: "Conscientiousness" },
  { text: "Is sophisticated in art, music, or literature", trait: "Openness" },
]

interface PersonalityTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (profile: PersonalityProfileOut) => void
}

export function PersonalityTestDialog({
  open,
  onOpenChange,
  onComplete,
}: PersonalityTestDialogProps) {
  const [answers, setAnswers] = useState<(number | null)[]>(
    Array(44).fill(null)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAnswer = (index: number, value: number) => {
    const next = [...answers]
    next[index] = value
    setAnswers(next)
  }

  const handleSubmit = async () => {
    if (answers.some((a) => a === null)) {
      setError("Please answer all questions.")
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const profile = await submitPersonalityTest(
        answers.map((a) => a ?? 1) as number[]
      )
      onComplete?.(profile)
      setAnswers(Array(44).fill(null))
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save results.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setError(null)
    if (!isSubmitting) {
      setAnswers(Array(44).fill(null))
      onOpenChange(false)
    }
  }

  const answeredCount = answers.filter((a) => a !== null).length
  const isComplete = answeredCount === 44

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Big Five Personality Test (BFI-44)</DialogTitle>
          <DialogDescription>
            Answer all 44 questions so Ditto can mirror your personality with
            high accuracy. This is the full Big Five Inventory—each trait is
            measured by 8–10 items.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 py-1">
          <Progress value={(answeredCount / 44) * 100} className="flex-1 h-2" />
          <span className="text-xs text-muted-foreground shrink-0">
            {answeredCount}/44
          </span>
        </div>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          {BFI_ITEMS.map((item, index) => (
            <div key={index} className="space-y-2">
              <Label className="text-sm font-medium">
                <span className="text-muted-foreground mr-1">{index + 1}.</span>
                I see myself as someone who {item.text}.
              </Label>
              <RadioGroup
                value={
                  answers[index] !== null ? String(answers[index]) : ""
                }
                onValueChange={(v) =>
                  handleAnswer(index, parseInt(v, 10))
                }
                className="flex flex-wrap gap-3"
              >
                {SCALE_LABELS.map((label, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <RadioGroupItem
                      value={String(i + 1)}
                      id={`q${index}-${i}`}
                    />
                    <Label
                      htmlFor={`q${index}-${i}`}
                      className="text-xs font-normal cursor-pointer text-muted-foreground"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save results"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
