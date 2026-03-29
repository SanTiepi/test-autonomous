// OIR Loader — parse, validate, compile, and dynamically import OIR modules

import { parseOir } from './parser.mjs';
import { validateOir } from './validator.mjs';
import { compileOirToJs } from './compiler.mjs';

/**
 * Load an OIR source string into a live JS module.
 * @param {string} source - OIR source text
 * @returns {Promise<{module: object|null, exports: object|null, meta: object}>}
 */
export async function loadOirModule(source) {
  const parsed = parseOir(source);
  if (parsed.errors?.length) {
    return { module: null, exports: null, meta: { errors: parsed.errors, phase: 'parse' } };
  }
  const v = validateOir(parsed);
  if (!v.valid) {
    return { module: null, exports: null, meta: { errors: v.diagnostics, phase: 'validate' } };
  }
  const { code } = compileOirToJs(parsed);
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const mod = await import(url);
  return { module: parsed, exports: mod, meta: { code, phase: 'loaded', errors: [] } };
}

/**
 * Serialize a parsed OIR module back to .oir text.
 * @param {object} mod - parsed OIR module
 * @returns {string}
 */
export function serializeModule(mod) {
  const lines = [];

  lines.push(`mod ${mod.id} v${mod.version}`);

  if (mod.exports && mod.exports.length > 0) {
    lines.push(`exp ${mod.exports.join(' ')}`);
  }

  if (mod.state && mod.state.length > 0) {
    const stParts = mod.state.map(s => typeof s === 'string' ? s : `${s.name}:${s.type}`);
    lines.push(`st ${stParts.join(' ')}`);
  }

  lines.push('');

  for (const [blockId, blk] of mod.blocks) {
    const inputs = blk.inputs ? `(${blk.inputs.join(' ')})` : '()';
    const outputs = blk.outputs ? `(${blk.outputs.join(' ')})` : '()';
    const effects = blk.effects && blk.effects.length > 0
      ? ' ' + blk.effects.map(e => `!${e}`).join(' ')
      : '';
    lines.push(`blk ${blockId} ${inputs} -> ${outputs}${effects}`);

    for (const inst of blk.instructions) {
      if (inst.op === 'label') {
        lines.push(`:${inst.label || inst.args[0]}`);
      } else {
        const parts = [inst.op];
        if (inst.dst) parts.push(inst.dst);
        if (inst.args && inst.args.length > 0) parts.push(...inst.args);
        lines.push(`  ${parts.join(' ')}`);
      }
    }

    lines.push('');
  }

  if (mod.tests && mod.tests.length > 0) {
    for (const t of mod.tests) {
      lines.push(`test ${JSON.stringify(t.description || t.desc || t.name)}`);
      if (t.instructions) {
        for (const inst of t.instructions) {
          const parts = [inst.op];
          if (inst.dst) parts.push(inst.dst);
          if (inst.args && inst.args.length > 0) parts.push(...inst.args);
          lines.push(`  ${parts.join(' ')}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Replace a semantic block in a module by ID.
 * @param {object} mod - parsed OIR module
 * @param {string} blockId - ID of the block to replace
 * @param {string[]} newBlockLines - new block source lines (including the blk header)
 * @returns {Promise<{module: object|null, exports: object|null, meta: object}>}
 */
export async function replaceSemanticBlock(mod, blockId, newBlockLines) {
  // Serialize existing module
  const source = serializeModule(mod);

  // Find and replace the block in the source
  const lines = source.split('\n');
  const result = [];
  let inTargetBlock = false;
  let replaced = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('blk ')) {
      const parts = trimmed.split(/\s+/);
      if (parts[1] === blockId) {
        inTargetBlock = true;
        replaced = true;
        // Insert new block lines
        for (const nl of newBlockLines) {
          result.push(nl);
        }
        continue;
      }
    }

    if (inTargetBlock) {
      // Skip lines until we hit the next block, test, or empty line after content
      if (trimmed === '' || trimmed.startsWith('blk ') || trimmed.startsWith('test ')) {
        inTargetBlock = false;
        if (trimmed.startsWith('blk ') || trimmed.startsWith('test ')) {
          result.push(line);
        } else {
          result.push(line);
        }
      }
      // else skip the old block line
      continue;
    }

    result.push(line);
  }

  const newSource = result.join('\n');
  // Re-parse the modified source
  const parsed = parseOir(newSource);
  return { module: parsed, exports: null, meta: { source: newSource, phase: replaced ? 'replaced' : 'not_found' } };
}
