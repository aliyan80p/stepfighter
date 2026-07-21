/**
 * Score-conversion formulas verified from USMLE Fighter's Score Calculator
 * (app.usmlefighter.com, Angular bundle `main.572ce89f7fe24578b9a2.js`).
 *
 * Default model:  score = slope * wrong + intercept
 *
 * Special case — Step 1 UWSA 1/2/3: Fighter still asks for "number wrong",
 * but internally converts it to a percentage before applying the line:
 *   score = slope * (wrong / totalQuestions * 100) + intercept
 * Marked with `inputMode: "wrongPercent"` — the UI label stays "wrong".
 */

export type StepKey = "step1" | "step2ck";
export type InputMode = "wrong" | "wrongPercent";

export interface ScoreFormula {
  id: string;
  step: StepKey;
  label: string;
  totalQuestions: number;
  /** Regression slope (Fighter: `firstvalue`). */
  slope: number;
  /** Regression intercept (Fighter: `secondvalue`). */
  intercept: number;
  /** What the user is asked to enter. */
  inputMode: InputMode;
  /** Every entry here is taken verbatim from Fighter's bundle. */
  verified: true;
}

export const SCORE_FORMULAS: ScoreFormula[] = [
  // Step 1 — NBME (input: number wrong, out of 200)
  { id: "step1-nbme25", step: "step1", label: "Step 1 · NBME 25", totalQuestions: 200, slope: -1.113,  intercept: 277.4,  inputMode: "wrong", verified: true },
  { id: "step1-nbme26", step: "step1", label: "Step 1 · NBME 26", totalQuestions: 200, slope: -1.1275, intercept: 276.38, inputMode: "wrong", verified: true },
  { id: "step1-nbme27", step: "step1", label: "Step 1 · NBME 27", totalQuestions: 200, slope: -1.1211, intercept: 276.53, inputMode: "wrong", verified: true },
  { id: "step1-nbme28", step: "step1", label: "Step 1 · NBME 28", totalQuestions: 200, slope: -1.1701, intercept: 278.36, inputMode: "wrong", verified: true },
  { id: "step1-nbme29", step: "step1", label: "Step 1 · NBME 29", totalQuestions: 200, slope: -1.1522, intercept: 276.92, inputMode: "wrong", verified: true },
  { id: "step1-nbme30", step: "step1", label: "Step 1 · NBME 30", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },
  { id: "step1-nbme31", step: "step1", label: "Step 1 · NBME 31", totalQuestions: 200, slope: -1.1435, intercept: 277.21, inputMode: "wrong", verified: true },

  // Step 1 — UWSA (input: number CORRECT, converted to percentage, out of 160)
  { id: "step1-uwsa1", step: "step1", label: "Step 1 · UWSA 1", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },
  { id: "step1-uwsa2", step: "step1", label: "Step 1 · UWSA 2", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },
  { id: "step1-uwsa3", step: "step1", label: "Step 1 · UWSA 3", totalQuestions: 160, slope: 1.8458, intercept: 107.6, inputMode: "correctPercent", verified: true },

  // Step 2 CK — NBME (input: number wrong, out of 200)
  { id: "step2-nbme9",  step: "step2ck", label: "Step 2 CK · NBME 9",  totalQuestions: 200, slope: -0.9, intercept: 295, inputMode: "wrong", verified: true },
  { id: "step2-nbme10", step: "step2ck", label: "Step 2 CK · NBME 10", totalQuestions: 200, slope: -0.9, intercept: 293, inputMode: "wrong", verified: true },
  { id: "step2-nbme11", step: "step2ck", label: "Step 2 CK · NBME 11", totalQuestions: 200, slope: -0.8, intercept: 287, inputMode: "wrong", verified: true },
  { id: "step2-nbme12", step: "step2ck", label: "Step 2 CK · NBME 12", totalQuestions: 200, slope: -0.8, intercept: 286, inputMode: "wrong", verified: true },
  { id: "step2-nbme13", step: "step2ck", label: "Step 2 CK · NBME 13", totalQuestions: 200, slope: -0.9, intercept: 295, inputMode: "wrong", verified: true },
  { id: "step2-nbme14", step: "step2ck", label: "Step 2 CK · NBME 14", totalQuestions: 200, slope: -0.9, intercept: 293, inputMode: "wrong", verified: true },

  // Step 2 CK — UWSA (input: number wrong, out of 160)
  { id: "step2-uwsa1", step: "step2ck", label: "Step 2 CK · UWSA 1", totalQuestions: 160, slope: -1.0956, intercept: 293.59, inputMode: "wrong", verified: true },
  { id: "step2-uwsa2", step: "step2ck", label: "Step 2 CK · UWSA 2", totalQuestions: 160, slope: -1.0273, intercept: 292.02, inputMode: "wrong", verified: true },
  { id: "step2-uwsa3", step: "step2ck", label: "Step 2 CK · UWSA 3", totalQuestions: 160, slope: -1.0956, intercept: 293.59, inputMode: "wrong", verified: true },
];

/**
 * Predict the 3-digit score.
 * @param input For `inputMode: "wrong"` this is the number of wrong answers;
 *              for `inputMode: "correctPercent"` this is the number of CORRECT answers.
 */
export function predictScore(formula: ScoreFormula, input: number): number {
  const x = formula.inputMode === "correctPercent"
    ? (input / formula.totalQuestions) * 100
    : input;
  const raw = formula.slope * x + formula.intercept;
  return Math.max(1, Math.min(300, Math.round(raw)));
}
