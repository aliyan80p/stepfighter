// Lightweight SM-2 inspired scheduler
export type Rating = "again" | "hard" | "good" | "easy";
export type CardState = "new" | "learning" | "review";

export interface CardSched {
  state: CardState;
  interval_days: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface NextSched extends CardSched {
  due_at: string; // ISO
}

const LEARN_STEPS_MIN = [1, 10]; // minutes for learning steps

export function schedule(card: CardSched, rating: Rating, now = new Date()): NextSched {
  let { state, interval_days, ease, reps, lapses } = card;
  const nowMs = now.getTime();
  let dueMs = nowMs;

  if (state === "new" || state === "learning") {
    if (rating === "again") {
      state = "learning";
      dueMs = nowMs + LEARN_STEPS_MIN[0] * 60_000;
    } else if (rating === "hard") {
      state = "learning";
      dueMs = nowMs + LEARN_STEPS_MIN[0] * 60_000;
    } else if (rating === "good") {
      // graduate
      state = "review";
      interval_days = 1;
      reps = 1;
      dueMs = nowMs + interval_days * 86_400_000;
    } else {
      // easy
      state = "review";
      interval_days = 4;
      reps = 1;
      dueMs = nowMs + interval_days * 86_400_000;
    }
  } else {
    // review
    if (rating === "again") {
      lapses += 1;
      ease = Math.max(1.3, ease - 0.2);
      interval_days = 1;
      state = "learning";
      dueMs = nowMs + LEARN_STEPS_MIN[0] * 60_000;
    } else {
      const mult = rating === "hard" ? 1.2 : rating === "good" ? ease : ease * 1.3;
      const easeDelta = rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0;
      ease = Math.max(1.3, ease + easeDelta);
      interval_days = Math.max(1, Math.round((interval_days || 1) * mult));
      reps += 1;
      dueMs = nowMs + interval_days * 86_400_000;
    }
  }
  return {
    state,
    interval_days,
    ease,
    reps,
    lapses,
    due_at: new Date(dueMs).toISOString(),
  };
}
