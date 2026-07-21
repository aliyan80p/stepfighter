import raw from "./usmle-lab-values.raw.json";

export interface LabRow {
  analyte: string;
  /** Optional secondary label rows, e.g. "Male / Female" or "Fasting / Random". */
  subgroups: string[];
  conventional: string[];
  si: string[];
}

export type LabTabKey = "Blood" | "Serum" | "Cerebrospinal" | "Urine and BMI";

const HEADER_LINES = new Set([
  "Lab Values",
  "SI Reference Intervals",
  "Blood",
  "Serum",
  "Cerebrospinal",
  "Urine and BMI",
]);

const TAB_HEADER_RE = /\t?REFERENCE RANGE(?:\tSI REFERENCE INTERVAL)?/;

function splitValueChunk(chunk: string): string[] {
  return chunk
    .split(/\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * The raw text is a linearized dump of the four Lab Values tables.
 * Rows are separated by two or more blank lines. Each row is roughly:
 *
 *   Analyte\n[subgroup lines...]\n\t\n[value lines...]           (conventional only)
 *   Analyte\n[subgroup lines...]\n\t\n[value lines...]\n\t\n[SI value lines...]   (SI variant)
 */
function parseTab(rawText: string, includeSI: boolean): LabRow[] {
  const cleaned = rawText.replace(/\r/g, "");
  // Drop the header/preamble lines (nav + column titles).
  const lines = cleaned.split("\n");
  let startIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (TAB_HEADER_RE.test(lines[i])) {
      startIdx = i + 1;
      break;
    }
  }
  const body = lines.slice(startIdx).join("\n");
  const blocks = body.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  const rows: LabRow[] = [];
  for (const block of blocks) {
    if (!block) continue;
    // Skip pure header echoes that sometimes appear at the top of a tab.
    if (HEADER_LINES.has(block)) continue;
    const chunks = block.split(/\n?\t\n?/).map((c) => c.trim());
    if (chunks.length < 2) continue;
    const [nameChunk, convChunk, siChunk] = chunks;
    const nameLines = nameChunk.split("\n").map((s) => s.trim()).filter(Boolean);
    if (nameLines.length === 0) continue;
    const analyte = nameLines[0];
    const subgroups = nameLines.slice(1);
    const conventional = splitValueChunk(convChunk ?? "");
    const si = includeSI ? splitValueChunk(siChunk ?? "") : [];
    if (conventional.length === 0 && si.length === 0) continue;
    rows.push({ analyte, subgroups, conventional, si });
  }
  return rows;
}

const rawTyped = raw as Record<LabTabKey, { conventional: { raw: string }; si: { raw: string } }>;

export const LAB_TABS: { key: LabTabKey; label: string; rows: LabRow[] }[] = (
  ["Blood", "Serum", "Cerebrospinal", "Urine and BMI"] as LabTabKey[]
).map((key) => ({
  key,
  label: key === "Cerebrospinal" ? "CSF" : key === "Urine and BMI" ? "Urine / BMI" : key,
  // Parse from the SI variant so we get both columns; hide SI at render time.
  rows: parseTab(rawTyped[key].si.raw, true),
}));
