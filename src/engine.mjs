// engine.mjs — Autonomous change engine.
// Observes the repo, decides the next best action, executes, verifies, learns.
// No human prompt needed. Runs continuously until stopped.

import { callCodex, formatClaudeReport } from './duo.mjs';
import { retrieveContext, updateMemoryAfterTask, loadProjectMemory } from './context.mjs';
import { createTransformEntry, appendTransform, loadTransformLog, summarizeLog, hashFiles } from './transform_log.mjs';
import { loadConfig } from './config.mjs';
import { execSync } from 'node:child_process';

// ── Opportunity Detection ──

async function detectOpportunities(root, config) {
  const memory = await loadProjectMemory(root);
  const log = await loadTransformLog(root);
  const logSummary = summarizeLog(log);

  // Ask Codex to analyze the repo and propose the highest-leverage change
  const result = await callCodex(`You are the autonomous change engine. Analyze this project and propose the SINGLE highest-impact improvement.

PROJECT MEMORY:
- Modules: ${Object.keys(memory.module_map).join(', ')}
- Conventions: ${memory.conventions.join('; ')}
- Recent decisions: ${memory.recent_decisions.slice(-3).map(d => d.task).join('; ')}
- Transform log: ${JSON.stringify(logSummary)}

Rules:
- Propose ONE atomic change (not a plan, not a list)
- It must be verifiable by tests
- Prefer: missing tests > bugs > refactors > features
- Do NOT propose changes to the engine itself

Return format:
TYPE: fix|feat|refactor|test
GOAL: one line
FILES: paths
DO: 1-3 lines
TEST: what to verify
IMPACT: why this matters
CONFIDENCE: high|medium|low`, config);

  return result.text;
}

// ── Execution Cycle ──

async function executeCycle(root, config, plan, executeTask) {
  const filesFromPlan = (plan.files || '').split(',').map(f => f.trim()).filter(Boolean);

  // Hash files before
  const filesBefore = await hashFiles(root, filesFromPlan);

  // Count tests before
  let testsBefore = { pass: 0, fail: 0 };
  try {
    const r = execSync('node --test test/*.test.mjs 2>&1', { cwd: root, timeout: 30000 }).toString();
    const m = r.match(/pass (\d+)/);
    testsBefore = { pass: m ? parseInt(m[1]) : 0, fail: 0 };
  } catch (e) {
    const m = e.stdout?.toString().match(/pass (\d+).*fail (\d+)/s);
    testsBefore = { pass: m ? parseInt(m[1]) : 0, fail: m ? parseInt(m[2]) : 0 };
  }

  // Execute the task (Claude does the work)
  const startMs = Date.now();
  const result = await executeTask(plan);
  const durationMs = Date.now() - startMs;

  // Count tests after
  let testsAfter = { pass: 0, fail: 0 };
  try {
    const r = execSync('node --test test/*.test.mjs 2>&1', { cwd: root, timeout: 30000 }).toString();
    const m = r.match(/pass (\d+)/);
    testsAfter = { pass: m ? parseInt(m[1]) : 0, fail: 0 };
  } catch (e) {
    const m = e.stdout?.toString().match(/pass (\d+).*fail (\d+)/s);
    testsAfter = { pass: m ? parseInt(m[1]) : 0, fail: m ? parseInt(m[2]) : 0 };
  }

  // Hash files after
  const filesAfter = await hashFiles(root, filesFromPlan);

  // Detect changed symbols (simplified)
  const symbolsAdded = [];
  const symbolsModified = [];

  // Log the transform
  const entry = createTransformEntry({
    type: plan.type || plan.fix ? 'fix' : plan.feat ? 'feat' : plan.refactor ? 'refactor' : 'test',
    goal: plan.goal || plan.do || '(unknown)',
    files_before: filesBefore,
    files_after: filesAfter,
    symbols_added: symbolsAdded,
    symbols_modified: symbolsModified,
    tests_before: testsBefore,
    tests_after: testsAfter,
    codex_plan: plan.do,
    duration_ms: durationMs,
  });
  await appendTransform(root, entry);

  // Update memory
  const changedFiles = Object.keys(filesAfter).filter(f => filesBefore[f] !== filesAfter[f]);
  if (changedFiles.length > 0) {
    await updateMemoryAfterTask(root, plan.goal || plan.do, changedFiles);
  }

  return {
    entry,
    testsBefore,
    testsAfter,
    regression: testsAfter.fail > testsBefore.fail,
    improved: testsAfter.pass > testsBefore.pass,
  };
}

// ── Review Cycle ──

async function reviewResult(result, config) {
  const report = `TYPE: ${result.entry.type}
GOAL: ${result.entry.goal}
TESTS: ${result.testsBefore.pass} → ${result.testsAfter.pass}
REGRESSION: ${result.regression}
DURATION: ${result.entry.meta.duration_ms}ms`;

  const review = await callCodex(`REVIEW this autonomous change:
${report}
VERDICT: approve if tests improved and no regression, challenge if uncertain, reject if regression.`, config);

  return review.text;
}

export { detectOpportunities, executeCycle, reviewResult };
