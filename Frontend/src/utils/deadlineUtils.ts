export interface ParsedBidDeadlines {
  submissionDeadline: string | null;
  bidOpeningDate: string | null;
}

const DATE_TIME =
  String.raw`\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}(?:\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?)?`;

const SUBMISSION_PATTERNS = [
  new RegExp(`bid\\s+submission\\s+deadline\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
  new RegExp(`last\\s+date\\s+(?:of\\s+)?submission\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
  new RegExp(`submission\\s+deadline\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
];

const OPENING_PATTERNS = [
  new RegExp(`bid\\s+opening\\s+date\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
  new RegExp(`technical\\s+bid\\s+opening\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
  new RegExp(`financial\\s+bid\\s+opening\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
  new RegExp(`bid\\s+opening\\s*[:\\-]?\\s*(${DATE_TIME})`, "i"),
];

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function isValidDateValue(value: string | null | undefined): value is string {
  if (!value) return false;
  const v = value.trim();
  return v.length > 0 && v.toUpperCase() !== "N/A" && /\d/.test(v);
}

function coerceToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(coerceToText).filter(Boolean).join("\n");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const pick = o.text ?? o.criterion ?? o.description ?? o.deadline ?? o.date ?? o.value;
    if (typeof pick === "string") return pick.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Parse bid submission deadline and bid opening date from analysis payloads. */
export function parseBidDeadlines(
  keyDeadlines?: unknown,
  lastSubmissionDate?: unknown,
  bidOpeningDate?: unknown
): ParsedBidDeadlines {
  const text = coerceToText(keyDeadlines);

  let submissionDeadline: string | null = isValidDateValue(coerceToText(lastSubmissionDate))
    ? coerceToText(lastSubmissionDate)
    : null;
  let opening: string | null = isValidDateValue(coerceToText(bidOpeningDate))
    ? coerceToText(bidOpeningDate)
    : null;

  if (text) {
    if (!submissionDeadline) {
      submissionDeadline = firstMatch(text, SUBMISSION_PATTERNS);
    }
    if (!opening) {
      opening = firstMatch(text, OPENING_PATTERNS);
    }
  }

  return { submissionDeadline, bidOpeningDate: opening };
}
