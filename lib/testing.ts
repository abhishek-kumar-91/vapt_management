import type { Tone } from "@/components/status"

/** Testing-request statuses, labels and badge tones (shared by company and admin pages). */
export type TestingStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"

export const TESTING_LABELS: Record<TestingStatus, string> = {
  submitted: "Waiting for Pentest Scout",
  accepted: "Accepted",
  declined: "Declined",
  scheduled: "Scheduled",
  in_progress: "Testing in progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export const TESTING_TONE: Record<TestingStatus, Tone> = {
  submitted: "warning",
  accepted: "primary",
  declined: "critical",
  scheduled: "primary",
  in_progress: "primary",
  completed: "success",
  cancelled: "neutral",
}
