import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  checkCompliance,
  semanticDensity,
  autoTunePromptPrefix,
  buildAgentPrompt,
  RESPONSE_FORMATS,
} from "../src/lang/compliance.mjs";

describe("checkCompliance", () => {
  it("detects MIL-compliant response", () => {
    const response = "STATUS APPROVE\nDATA sound_architecture no_risk";
    const result = checkCompliance(response);
    assert.equal(result.compliant, true);
    assert.equal(result.status, "APPROVE");
  });

  it("detects MIL CHALLENGE response", () => {
    const response = "STATUS CHALLENGE\nDATA unbounded_map risk\nNEXT OP REFACTOR TGT limiter";
    const result = checkCompliance(response);
    assert.equal(result.compliant, true);
    assert.equal(result.status, "CHALLENGE");
  });

  it("rejects prose response", () => {
    const response = "The architecture looks good overall. I would recommend...";
    const result = checkCompliance(response);
    assert.equal(result.compliant, false);
  });

  it("rejects markdown response", () => {
    const response = "## Review\n\n**VERDICT**: APPROVE\n\nThe code is clean.";
    const result = checkCompliance(response);
    assert.equal(result.compliant, false);
  });

  it("counts words in non-compliant response", () => {
    const response = "This is a long prose response that should not be MIL compliant";
    const result = checkCompliance(response);
    assert.equal(result.compliant, false);
    assert.ok(result.words > 10);
  });
});

describe("semanticDensity", () => {
  it("rates MIL response as high density", () => {
    const response = "STATUS APPROVE\nDATA clean_impl zero_risk 58t_pass";
    const result = semanticDensity(response, 12);
    assert.equal(result.rating, "high");
    assert.ok(result.density > 0.8);
  });

  it("rates verbose prose as low density", () => {
    const response = [
      "The implementation is quite good however there are some concerns.",
      "I would suggest that you should really consider the performance.",
      "Furthermore the architecture could be somewhat improved.",
      "Additionally please have a look at the error handling.",
    ].join(" ");
    const result = semanticDensity(response, 40);
    assert.ok(result.density < 0.7);
    assert.ok(["low", "very_low"].includes(result.rating));
  });

  it("rates concise prose higher than verbose", () => {
    const concise = "Memory leak: Map grows unbounded. Add LRU cap at 10k entries.";
    const verbose = "I have noticed that there might possibly be a potential memory leak issue because the Map could perhaps grow in an unbounded fashion and you should really consider adding some kind of LRU cap.";
    const conciseResult = semanticDensity(concise, 15);
    const verboseResult = semanticDensity(verbose, 45);
    assert.ok(conciseResult.density > verboseResult.density);
  });
});

describe("autoTunePromptPrefix", () => {
  it("light touch at high compliance", () => {
    const prefix = autoTunePromptPrefix(0.95, "STATUS X\nDATA Y");
    assert.ok(prefix.includes("Reply in MIL format"));
    assert.ok(!prefix.includes("CRITICAL"));
  });

  it("firm instruction at medium compliance", () => {
    const prefix = autoTunePromptPrefix(0.6, "STATUS X\nDATA Y");
    assert.ok(prefix.includes("RESPOND ONLY"));
    assert.ok(!prefix.includes("CRITICAL"));
  });

  it("maximum constraint at low compliance", () => {
    const prefix = autoTunePromptPrefix(0.2, "STATUS X\nDATA Y");
    assert.ok(prefix.includes("CRITICAL PROTOCOL REQUIREMENT"));
    assert.ok(prefix.includes("protocol violation"));
  });

  it("maximum constraint at zero compliance", () => {
    const prefix = autoTunePromptPrefix(0, "STATUS X\nDATA Y");
    assert.ok(prefix.includes("CRITICAL"));
  });
});

describe("buildAgentPrompt", () => {
  it("builds critic prompt with auto-tuned prefix", () => {
    const prompt = buildAgentPrompt("critic", "OP REVIEW\nTGT src/index.mjs", 0.3);
    assert.ok(prompt.includes("CRITICAL"));
    assert.ok(prompt.includes("APPROVE|CHALLENGE|REJECT"));
    assert.ok(prompt.includes("OP REVIEW"));
  });

  it("builds scout prompt", () => {
    const prompt = buildAgentPrompt("scout", "OP SEARCH\nTGT src/", 0.9);
    assert.ok(prompt.includes("Reply in MIL"));
    assert.ok(prompt.includes("files:<count>"));
  });

  it("builds verify prompt", () => {
    const prompt = buildAgentPrompt("verify", "OP TEST\nTGT tests/", 0.5);
    assert.ok(prompt.includes("RESPOND ONLY"));
    assert.ok(prompt.includes("DONE|FAIL"));
  });

  it("rejects unknown agent type", () => {
    assert.throws(() => buildAgentPrompt("unknown", "OP TEST"), /Unknown agent type/);
  });
});

describe("RESPONSE_FORMATS", () => {
  it("has all three agent types", () => {
    assert.ok(RESPONSE_FORMATS.critic);
    assert.ok(RESPONSE_FORMATS.scout);
    assert.ok(RESPONSE_FORMATS.verify);
  });

  it("critic format includes STATUS and DATA", () => {
    assert.ok(RESPONSE_FORMATS.critic.includes("STATUS"));
    assert.ok(RESPONSE_FORMATS.critic.includes("DATA"));
  });
});
