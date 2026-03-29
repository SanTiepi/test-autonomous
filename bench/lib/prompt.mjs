export function buildBenchmarkPrompt({ task, variant, promptContext }) {
  const acceptance = task.acceptance.map((item) => `- ${item}`).join("\n");
  const allowedPaths = (task.allowed_paths ?? [task.module]).map((item) => `- ${item}`).join("\n");

  return [
    "You are participating in a controlled benchmark about code representations for LLM editing.",
    "Edit only the allowed source files. Do not modify tests. Do not add files.",
    "Return JSON only.",
    "",
    `TASK_ID: ${task.id}`,
    `TASK_KIND: ${task.kind}`,
    `TARGET_MODULE: ${task.module}`,
    `TARGET_SYMBOL: ${task.symbol}`,
    `REPRESENTATION: ${variant.id}`,
    "",
    "OBJECTIVE",
    task.prompt,
    "",
    "ACCEPTANCE_CRITERIA",
    acceptance,
    "",
    "ALLOWED_PATHS",
    allowedPaths,
    "",
    "RESPONSE_SCHEMA",
    '{"changes":[{"path":"src/lang/target.mjs","content":"<entire updated file content>"}],"notes":"<brief summary>"}',
    "",
    "PROMPT_CONTEXT",
    promptContext,
  ].join("\n");
}
