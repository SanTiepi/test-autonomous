import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encode, decode, encodeResponse, decodeResponse, estimateTokens, benchmark, registerOp, getOps } from "../src/lang/mil.mjs";

describe("MIL encode", () => {
  it("encodes minimal message (OP only)", () => {
    const result = encode({ op: "REVIEW" });
    assert.equal(result, "OP REVIEW");
  });

  it("encodes full message", () => {
    const result = encode({
      op: "REVIEW",
      tgt: "src/api/users.mjs",
      ctx: "39t_pass mid02_done",
      arg: { focus: "security", depth: "full" },
      out: "VERDICT reason",
      pri: 7,
    });
    const lines = result.split("\n");
    assert.equal(lines[0], "OP REVIEW");
    assert.equal(lines[1], "TGT src/api/users.mjs");
    assert.equal(lines[2], "CTX 39t_pass mid02_done");
    assert.ok(lines[3].startsWith("ARG "));
    assert.ok(lines[3].includes("focus=security"));
    assert.equal(lines[4], "OUT VERDICT reason");
    assert.equal(lines[5], "PRI 7");
  });

  it("rejects invalid OP", () => {
    assert.throws(() => encode({ op: "DANCE" }), /invalid OP/);
  });
});

describe("MIL decode", () => {
  it("decodes minimal message", () => {
    const msg = decode("OP REVIEW");
    assert.equal(msg.op, "REVIEW");
  });

  it("decodes full message", () => {
    const raw = [
      "OP SEARCH",
      "TGT src/",
      "CTX fresh_session",
      "ARG pattern=*.mjs depth=2",
      "OUT files_list",
      "PRI 3",
    ].join("\n");
    const msg = decode(raw);
    assert.equal(msg.op, "SEARCH");
    assert.equal(msg.tgt, "src/");
    assert.equal(msg.ctx, "fresh_session");
    assert.deepEqual(msg.arg, { pattern: "*.mjs", depth: "2" });
    assert.equal(msg.out, "files_list");
    assert.equal(msg.pri, 3);
  });

  it("rejects unknown OP", () => {
    assert.throws(() => decode("OP DESTROY"), /unknown OP/);
  });

  it("rejects malformed line", () => {
    assert.throws(() => decode("NOSPACE"), /malformed/);
  });

  it("rejects missing OP", () => {
    assert.throws(() => decode("TGT foo"), /OP is required/);
  });

  it("rejects PRI out of range", () => {
    assert.throws(() => decode("OP TEST\nPRI 10"), /PRI must be 0-9/);
  });
});

describe("MIL response", () => {
  it("encodes response", () => {
    const result = encodeResponse({ status: "APPROVE", data: "clean_impl no_issues" });
    assert.equal(result, "STATUS APPROVE\nDATA clean_impl no_issues");
  });

  it("decodes response", () => {
    const resp = decodeResponse("STATUS CHALLENGE\nDATA perf_risk fixed_window_memory\nNEXT OP REFACTOR");
    assert.equal(resp.status, "CHALLENGE");
    assert.equal(resp.data, "perf_risk fixed_window_memory");
    assert.equal(resp.next, "OP REFACTOR");
  });

  it("rejects unknown status", () => {
    assert.throws(() => decodeResponse("STATUS MAYBE"), /unknown STATUS/);
  });
});

describe("MIL roundtrip", () => {
  it("encode → decode preserves data", () => {
    const original = {
      op: "IMPLEMENT",
      tgt: "src/auth.mjs",
      ctx: "no_auth_yet 0dep",
      arg: { pattern: "jwt", scope: "api" },
      out: "file_path test_count",
      pri: 8,
    };
    const encoded = encode(original);
    const decoded = decode(encoded);
    assert.equal(decoded.op, original.op);
    assert.equal(decoded.tgt, original.tgt);
    assert.equal(decoded.ctx, original.ctx);
    assert.deepEqual(decoded.arg, original.arg);
    assert.equal(decoded.out, original.out);
    assert.equal(decoded.pri, original.pri);
  });
});

describe("MIL ROOT field", () => {
  it("encodes and decodes ROOT", () => {
    const msg = { op: "REVIEW", tgt: "src/index.mjs", root: "C:\\PROJET IA\\test-autonomous" };
    const encoded = encode(msg);
    assert.ok(encoded.includes("ROOT C:\\PROJET IA\\test-autonomous"));
    const decoded = decode(encoded);
    assert.equal(decoded.root, "C:\\PROJET IA\\test-autonomous");
  });
});

describe("MIL vocabulary evolution", () => {
  it("PATCH is a valid core OP", () => {
    const msg = decode("OP PATCH\nTGT src/fix.mjs");
    assert.equal(msg.op, "PATCH");
  });

  it("registerOp adds new OP", () => {
    const added = registerOp("MIGRATE");
    assert.equal(added, true);
    const msg = decode("OP MIGRATE\nTGT db/schema.sql");
    assert.equal(msg.op, "MIGRATE");
  });

  it("registerOp rejects duplicate", () => {
    const added = registerOp("REVIEW");
    assert.equal(added, false);
  });

  it("getOps returns all registered OPs", () => {
    const ops = getOps();
    assert.ok(ops.includes("REVIEW"));
    assert.ok(ops.includes("PATCH"));
    assert.ok(ops.includes("MIGRATE"));
  });
});

describe("MIL benchmarks", () => {
  it("estimates tokens", () => {
    assert.equal(estimateTokens("hello world"), 3); // 11 chars / 4 = 2.75 → 3
  });

  it("shows savings vs prose and JSON", () => {
    const mil = "OP REVIEW\nTGT rate_limiter.mjs\nCTX 39t_pass\nARG focus=perf\nOUT VERDICT";
    const json = '{"op":"review","target":"rate_limiter.mjs","context":{"tests":39},"args":{"focus":"perf"},"output":"verdict"}';
    const prose = "Please review rate_limiter.mjs. We have 39 tests passing. Focus on performance. Give me your verdict.";
    const result = benchmark({ mil, json, prose });
    assert.ok(result.mil < result.prose, "MIL should use fewer tokens than prose");
    assert.ok(result.mil < result.json, "MIL should use fewer tokens than JSON");
  });
});
