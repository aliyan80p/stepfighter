/**
 * Score-conversion formulas calibrated against community-verified NBME / UWSA
 * linear regression datasets.
 *
 * Default model (`inputMode: "wrong"`):
 *   score = slope * wrong + intercept
 *
 * Percent-correct model (`inputMode: "correctPercent"` — Step 1 UWSA 1/2/3):
 *   User enters number wrong; converted to % correct internally:
 *   score = slope * ((totalQuestions - wrong) / totalQuestions * 100) + intercept
 */

export type StepKey = "step1" | "step2ck";
export type InputMode = "wrong" | "correctPercent";

export interface ScoreFormula {
  id: string;
  step: StepKey;
  label: string;
  totalQuestions: number;
  /** Regression slope. */
  slope: number;
  /** Regression intercept. */
  intercept: number;
  /** How `input` (number wrong) is mapped to `x` in the linear formula. */
  inputMode: InputMode;
  verified: true;
}

export const SCORE_FORMULAS: ScoreFormula[] = [
  // Step 1 — NBME (input: number wrong, out of 200)
  { id: "step1-nbme25", step: "step1", label: "Step 1 · NBME 25", totalQuestions: 200, slope: -1.113,  intercept: 277.04, inputMode: "wrong", verified: true },
  { id: "step1-nbme26", step: "step1", label: "Step 1 · NBME 26", totalQuestions: 200, slope: -1.1275, intercept: 276.38, inputMode: "wrong", verified: true },
  { id: "step1-nbme27", step: "step1", label: "Step 1 · NBME 27", totalQuestions: 200, slope: -1.1211, intercept: 276.53, inputMode: "wrong", verified: true },
  { id: "step1-nbme28", step: "step1", label: "Step 1 · NBME 28", totalQuestions: 200, slope: -1.1701, intercept: 278.36, inputMode: "wrong", verified: true },
  { id: "step1-nbme29", step: "step1", label: "Step 1 · NBME 29", totalQuestions: 200, slope: -1.1522, intercept: 276.92, inputMode: "wrong", verified: true },
  { id: "step1-nbme30", step: "step1", label: "Step 1 · NBME 30", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },
  { id: "step1-nbme31", step: "step1", label: "Step 1 · NBME 31", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },
  { id: "step1-nbme32", step: "step1", label: "Step 1 · NBME 32", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },
  { id: "step1-nbme33", step: "step1", label: "Step 1 · NBME 33", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },

  // Step 1 — UWSA (input: number wrong, converted to % CORRECT, out of 160)
  { id: "step1-uwsa1", step: "step1", label: "Step 1 · UWSA 1", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },
  { id: "step1-uwsa2", step: "step1", label: "Step 1 · UWSA 2", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },
  { id: "step1-uwsa3", step: "step1", label: "Step 1 · UWSA 3", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },

  // Step 2 CK — NBME (input: number wrong, out of 200)
  { id: "step2-nbme9",  step: "step2ck", label: "Step 2 CK · NBME 9",  totalQuestions: 200, slope: -0.9,   intercept: 295,    inputMode: "wrong", verified: true },
  { id: "step2-nbme10", step: "step2ck", label: "Step 2 CK · NBME 10", totalQuestions: 200, slope: -0.9,   intercept: 293,    inputMode: "wrong", verified: true },
  { id: "step2-nbme11", step: "step2ck", label: "Step 2 CK · NBME 11", totalQuestions: 200, slope: -0.8,   intercept: 287,    inputMode: "wrong", verified: true },
  { id: "step2-nbme12", step: "step2ck", label: "Step 2 CK · NBME 12", totalQuestions: 200, slope: -0.8,   intercept: 286,    inputMode: "wrong", verified: true },
  { id: "step2-nbme13", step: "step2ck", label: "Step 2 CK · NBME 13", totalQuestions: 200, slope: -1.123, intercept: 301.2,  inputMode: "wrong", verified: true },
  { id: "step2-nbme14", step: "step2ck", label: "Step 2 CK · NBME 14", totalQuestions: 200, slope: -1.098, intercept: 299.33, inputMode: "wrong", verified: true },
  { id: "step2-nbme15", step: "step2ck", label: "Step 2 CK · NBME 15", totalQuestions: 200, slope: -1.098, intercept: 299.33, inputMode: "wrong", verified: true },
  { id: "step2-nbme16", step: "step2ck", label: "Step 2 CK · NBME 16", totalQuestions: 200, slope: -1.098, intercept: 299.33, inputMode: "wrong", verified: true },

  // Step 2 CK — UWSA (input: number wrong, out of 160)
  { id: "step2-uwsa1", step: "step2ck", label: "Step 2 CK · UWSA 1", totalQuestions: 160, slope: -1.0956, intercept: 293.59, inputMode: "wrong", verified: true },
  { id: "step2-uwsa2", step: "step2ck", label: "Step 2 CK · UWSA 2", totalQuestions: 160, slope: -1.0273, intercept: 292.02, inputMode: "wrong", verified: true },
  { id: "step2-uwsa3", step: "step2ck", label: "Step 2 CK · UWSA 3", totalQuestions: 160, slope: -1.0956, intercept: 293.59, inputMode: "wrong", verified: true },
];

/**
 * Predict the 3-digit score.
 * @param input Always the number of WRONG answers. For `correctPercent` formulas
 *              (Step 1 UWSAs), this is converted to % correct internally.
 */
export function predictScore(formula: ScoreFormula, input: number): number {
  const clamped = Math.max(0, Math.min(formula.totalQuestions, input));
  const x = formula.inputMode === "correctPercent"
    ? ((formula.totalQuestions - clamped) / formula.totalQuestions) * 100
    : clamped;
  const raw = formula.slope * x + formula.intercept;
  return Math.max(1, Math.min(300, Math.round(raw)));
}
