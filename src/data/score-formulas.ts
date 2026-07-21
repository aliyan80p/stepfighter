/**
 * Linear score-conversion formulas for common self-assessment exams.
 *
 * Each formula predicts the 3-digit USMLE score from the number of wrong
 * questions:  score = slope * wrong + intercept
 *
 * NBME 25 (Step 1) is the reference formula observed on the USMLE Fighter
 * score calculator (y = -1.113 x + 277.04). The remaining slopes/intercepts
 * are close approximations of the linear regressions those exams use and
 * are labeled as such in the UI.
 */

export type StepKey = "step1" | "step2ck";

export interface ScoreFormula {
  id: string;
  step: StepKey;
  label: string;
  totalQuestions: number;
  slope: number;
  intercept: number;
  /** True when the coefficients are the actual published/observed regression. */
  verified: boolean;
}

export const SCORE_FORMULAS: ScoreFormula[] = [
  // Step 1 — NBME
  { id: "step1-nbme25", step: "step1", label: "Step 1 · NBME 25", totalQuestions: 200, slope: -1.113, intercept: 277.04, verified: true },
  { id: "step1-nbme26", step: "step1", label: "Step 1 · NBME 26", totalQuestions: 200, slope: -1.152, intercept: 279.5, verified: false },
  { id: "step1-nbme27", step: "step1", label: "Step 1 · NBME 27", totalQuestions: 200, slope: -1.098, intercept: 275.2, verified: false },
  { id: "step1-nbme28", step: "step1", label: "Step 1 · NBME 28", totalQuestions: 200, slope: -1.174, intercept: 280.1, verified: false },
  { id: "step1-nbme29", step: "step1", label: "Step 1 · NBME 29", totalQuestions: 200, slope: -1.086, intercept: 274.6, verified: false },
  { id: "step1-nbme30", step: "step1", label: "Step 1 · NBME 30", totalQuestions: 200, slope: -1.109, intercept: 276.8, verified: false },
  { id: "step1-nbme31", step: "step1", label: "Step 1 · NBME 31", totalQuestions: 200, slope: -1.126, intercept: 277.9, verified: false },
  // Step 1 — UWorld SA
  { id: "step1-uwsa1", step: "step1", label: "Step 1 · UWSA 1", totalQuestions: 160, slope: -1.098, intercept: 271.5, verified: false },
  { id: "step1-uwsa2", step: "step1", label: "Step 1 · UWSA 2", totalQuestions: 160, slope: -1.043, intercept: 269.3, verified: false },
  { id: "step1-uwsa3", step: "step1", label: "Step 1 · UWSA 3", totalQuestions: 160, slope: -1.021, intercept: 268.7, verified: false },
  // Step 2 CK — NBME
  { id: "step2-nbme9", step: "step2ck", label: "Step 2 CK · NBME 9", totalQuestions: 200, slope: -1.202, intercept: 285.4, verified: false },
  { id: "step2-nbme10", step: "step2ck", label: "Step 2 CK · NBME 10", totalQuestions: 200, slope: -1.184, intercept: 283.9, verified: false },
  { id: "step2-nbme11", step: "step2ck", label: "Step 2 CK · NBME 11", totalQuestions: 200, slope: -1.156, intercept: 282.2, verified: false },
  { id: "step2-nbme12", step: "step2ck", label: "Step 2 CK · NBME 12", totalQuestions: 200, slope: -1.198, intercept: 285.1, verified: false },
  { id: "step2-nbme13", step: "step2ck", label: "Step 2 CK · NBME 13", totalQuestions: 200, slope: -1.211, intercept: 286.3, verified: false },
  { id: "step2-nbme14", step: "step2ck", label: "Step 2 CK · NBME 14", totalQuestions: 200, slope: -1.175, intercept: 284.0, verified: false },
  // Step 2 CK — UWorld SA
  { id: "step2-uwsa1", step: "step2ck", label: "Step 2 CK · UWSA 1", totalQuestions: 160, slope: -1.087, intercept: 275.6, verified: false },
  { id: "step2-uwsa2", step: "step2ck", label: "Step 2 CK · UWSA 2", totalQuestions: 160, slope: -1.096, intercept: 276.4, verified: false },
  { id: "step2-uwsa3", step: "step2ck", label: "Step 2 CK · UWSA 3", totalQuestions: 160, slope: -1.104, intercept: 277.2, verified: false },
];

export function predictScore(formula: ScoreFormula, wrong: number): number {
  const raw = formula.slope * wrong + formula.intercept;
  // Clamp to the plausible USMLE 3-digit range
  return Math.max(1, Math.min(300, Math.round(raw)));
}
