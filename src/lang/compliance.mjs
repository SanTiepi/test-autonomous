// MIL Compliance Tracker + Auto-Tuning
// Tracks agent response compliance and adjusts prompt constraints automatically

const MIL_RESPONSE_PATTERN = /^STATUS\s+(APPROVE|CHALLENGE|REJECT|DONE|FAIL|PARTIAL)\nDATA\s+.+/;

// Hoisted to module scope — avoids re-creation per call (critic recommendation)
const FILLER_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "please",
  "just", "very", "really", "quite", "rather", "somewhat",
  "however", "therefore", "furthermore", "additionally", "moreover",
  "here", "there", "this", "that", "these", "those",
]);

/**
 * Check if a raw agent response is MIL-compliant.
 * @param {string} response — raw agent output
 * @returns {{ compliant: boolean, status?: string, lines: number, words: number }}
 */
export function checkCompliance(response) {
  const trimmed = response.trim();
  const lines = trimmed.split("\n").filter(Boolean);
  const words = trimmed.split(/\s+/).length;

  if (!MIL_RESPONSE_PATTERN.test(trimmed)) {
    return { compliant: false, lines: lines.length, words };
  }

  const statusLine = lines[0];
  const status = statusLine.split(/\s+/)[1];

  return { compliant: true, status, lines: lines.length, words };
}

/**
 * Calculate semantic density: useful information per token.
 * MIL-compliant responses have higher density by definition.
 * @param {string} response
 * @param {number} estimatedTokens
 * @returns {{ density: number, rating: string }}
 */
export function semanticDensity(response, estimatedTokens) {
  const check = checkCompliance(response);

  if (check.compliant) {
    // MIL responses: every token carries meaning
    const density = 1.0 - (check.words > 50 ? 0.3 : 0);
    return { density, rating: density > 0.8 ? "high" : "medium" };
  }

  // Prose responses: estimate filler ratio
  const words = response.toLowerCase().split(/\s+/);
  const fillerCount = words.filter(w => FILLER_WORDS.has(w)).length;
  const density = Math.max(0, 1.0 - (fillerCount / words.length) - 0.1);
  const rating = density > 0.7 ? "medium" : density > 0.4 ? "low" : "very_low";

  return { density: Math.round(density * 100) / 100, rating };
}

/**
 * Generate the appropriate prompt prefix based on compliance history.
 * Auto-tunes constraint strength based on past compliance rate.
 *
 * @param {number} complianceRate — 0.0 to 1.0, from recent sessions
 * @param {string} responseFormat — the expected MIL response format
 * @returns {string} — prompt prefix to prepend to agent prompts
 */
export function autoTunePromptPrefix(complianceRate, responseFormat) {
  if (complianceRate >= 0.9) {
    // High compliance — light touch
    return `Reply in MIL format:\n${responseFormat}\n\n`;
  }

  if (complianceRate >= 0.5) {
    // Medium compliance — firm instruction
    return `RESPOND ONLY IN MIL FORMAT. Your entire output must be exactly:\n${responseFormat}\n\nNo other text. No markdown.\n\n`;
  }

  // Low compliance — maximum constraint
  return [
    "CRITICAL PROTOCOL REQUIREMENT.",
    "Your ENTIRE response must be EXACTLY this format and NOTHING ELSE:",
    "",
    responseFormat,
    "",
    "RULES:",
    "- No prose. No markdown. No explanations.",
    "- No text before STATUS. No text after the last field.",
    "- If you add ANY text outside this format, it is a protocol violation.",
    "- DATA field: max 50 words, compressed notation.",
    "",
  ].join("\n");
}

/**
 * Standard MIL response formats for each agent type.
 */
export const RESPONSE_FORMATS = {
  critic: [
    "STATUS <APPROVE|CHALLENGE|REJECT>",
    "DATA <max 50 words compressed reasoning>",
    "NEXT <follow-up OP TGT if not APPROVE>",
  ].join("\n"),

  scout: [
    "STATUS DONE",
    "DATA files:<count> entry:<path> patterns:<list> deps:<list> tests:<count>t gaps:<list>",
    "NEXT <suggested OP if issues found>",
  ].join("\n"),

  verify: [
    "STATUS <DONE|FAIL>",
    "DATA tests:<pass>/<total> build:<PASS|FAIL|NA> lint:<PASS|FAIL|NA>",
    "NEXT <OP DIAGNOSE if FAIL>",
  ].join("\n"),
};

/**
 * Build a complete agent prompt with auto-tuned MIL prefix.
 * @param {string} agentType — "critic" | "scout" | "verify"
 * @param {string} milRequest — the MIL-formatted request
 * @param {number} complianceRate — historical compliance rate
 * @returns {string}
 */
export function buildAgentPrompt(agentType, milRequest, complianceRate = 0) {
  const format = RESPONSE_FORMATS[agentType];
  if (!format) throw new Error(`Unknown agent type: ${agentType}`);
  const prefix = autoTunePromptPrefix(complianceRate, format);
  return `${prefix}Request:\n${milRequest}`;
}
