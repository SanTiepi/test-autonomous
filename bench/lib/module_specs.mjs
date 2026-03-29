export const MODULE_SPECS = {
  "src/lang/mil.mjs": {
    label: "MIL codec",
    description: "Compact line-oriented codec for inter-agent requests and responses.",
    testFiles: ["tests/mil.test.mjs", "tests/mil_benchmark.test.mjs"],
    sharedInvariants: [
      "MIL request field order is OP,TGT,ROOT,CTX,ARG,OUT,PRI",
      "MIL response field order is STATUS,DATA,NEXT,COST",
      "Unknown OP/STATUS and malformed lines fail fast with explicit errors",
    ],
    symbols: {
      registerOp: {
        effects: ["mutates VALID_OPS"],
        invariants: ["Uppercases runtime-added OP names", "Returns false for duplicates"],
        tests: ["tests/mil.test.mjs::MIL vocabulary evolution"],
      },
      getOps: {
        effects: ["reads VALID_OPS"],
        invariants: ["Returns a snapshot array of known OPs"],
        tests: ["tests/mil.test.mjs::MIL vocabulary evolution"],
      },
      decode: {
        effects: ["reads VALID_OPS"],
        invariants: ["Requires OP", "Parses ARG as key=value pairs", "Rejects malformed lines"],
        tests: ["tests/mil.test.mjs::MIL decode", "tests/mil.test.mjs::MIL roundtrip"],
      },
      decodeResponse: {
        effects: ["pure"],
        invariants: ["Requires STATUS", "Rejects unknown statuses"],
        tests: ["tests/mil.test.mjs::MIL response"],
      },
      encode: {
        effects: ["pure"],
        invariants: ["Emits OP first", "Optional fields preserve canonical order"],
        tests: ["tests/mil.test.mjs::MIL encode", "tests/mil.test.mjs::MIL roundtrip"],
      },
      encodeResponse: {
        effects: ["pure"],
        invariants: ["STATUS is mandatory", "COST may be omitted"],
        tests: ["tests/mil.test.mjs::MIL response"],
      },
      estimateTokens: {
        effects: ["pure"],
        invariants: ["Uses ceil(length / 4) rough estimate"],
        tests: ["tests/mil.test.mjs::MIL benchmarks"],
      },
      benchmark: {
        effects: ["pure"],
        invariants: ["Compares MIL vs JSON vs prose token counts"],
        tests: ["tests/mil.test.mjs::MIL benchmarks", "tests/mil_benchmark.test.mjs"],
      },
    },
  },
  "src/lang/compliance.mjs": {
    label: "MIL compliance",
    description: "Compliance tracking, density scoring, and prompt auto-tuning for MIL responses.",
    testFiles: ["tests/compliance.test.mjs"],
    sharedInvariants: [
      "MIL-compliant responses require STATUS then DATA",
      "Prompt strength increases as compliance rate drops",
      "Agent prompts must resolve through RESPONSE_FORMATS",
    ],
    symbols: {
      checkCompliance: {
        effects: ["pure"],
        invariants: ["Returns compliance flag plus lines/words metrics", "Extracts STATUS from first line"],
        tests: ["tests/compliance.test.mjs::checkCompliance"],
      },
      semanticDensity: {
        effects: ["pure"],
        invariants: ["MIL responses score denser than verbose prose", "Verbose filler lowers density"],
        tests: ["tests/compliance.test.mjs::semanticDensity"],
      },
      autoTunePromptPrefix: {
        effects: ["pure"],
        invariants: ["0.9+ => light touch", "0.5+ => firm instruction", "<0.5 => critical constraint"],
        tests: ["tests/compliance.test.mjs::autoTunePromptPrefix"],
      },
      buildAgentPrompt: {
        effects: ["pure"],
        invariants: ["Prepends tuned prefix", "Throws on unknown agent type"],
        tests: ["tests/compliance.test.mjs::buildAgentPrompt"],
      },
      RESPONSE_FORMATS: {
        effects: ["constant"],
        invariants: ["critic/scout/verify all present"],
        tests: ["tests/compliance.test.mjs::RESPONSE_FORMATS"],
      },
    },
  },
};

export function getModuleSpec(modulePath) {
  const spec = MODULE_SPECS[modulePath];
  if (!spec) {
    throw new Error(`No module spec for ${modulePath}`);
  }
  return spec;
}

export function getTestFilesForModule(modulePath) {
  return getModuleSpec(modulePath).testFiles;
}
