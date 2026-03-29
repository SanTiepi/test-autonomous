// OIR Validator — validates parsed OIR modules for semantic correctness.

const KNOWN_OPS = new Set([
  'lit', 'get', 'set', 'obj', 'arr', 'mov', 'len',
  'eq', 'neq', 'gt', 'lt', 'not', 'is', 'and', 'or',
  'br', 'brt', 'brf', 'ret', 'call',
  'st_get', 'st_set', 'st_del', 'st_has', 'st_vals',
  'now', 'uuid', 'emit', 'call_mod',
  'trim', 'add', 'sub', 'mul', 'cat',
  'lower', 'includes', 'push',
  'label',
  'assert_eq', 'assert_true', 'assert_emit',
]);

const BRANCH_OPS = new Set(['br', 'brt', 'brf']);

/**
 * @param {object} mod - parsed OIR module from parseOir
 * @returns {{valid: boolean, diagnostics: Array<{type:string, message:string, module:string, block:string|null, line:number|null}>}}
 */
export function validateOir(mod) {
  const diagnostics = [];
  const modId = mod.id || '(unknown)';

  function error(message, block = null, line = null) {
    diagnostics.push({ type: 'error', message, module: modId, block, line });
  }
  function warning(message, block = null, line = null) {
    diagnostics.push({ type: 'warning', message, module: modId, block, line });
  }

  // Module-level checks
  if (!mod.id || mod.id.trim() === '') {
    error('Module must have a non-empty id');
  }

  const ver = Number(mod.version);
  if (!ver || ver < 1 || !Number.isInteger(ver)) {
    error(`Module version must be a positive integer, got "${mod.version}"`);
  }

  // Exports reference existing blocks
  for (const exp of (mod.exports || [])) {
    if (!mod.blocks.has(exp)) {
      error(`Exported block "${exp}" not found`);
    }
  }

  // Collect all block ids, check uniqueness
  const blockIds = new Set();
  const referencedBlocks = new Set();

  for (const [blockId, block] of mod.blocks) {
    if (blockIds.has(blockId)) {
      error(`Duplicate block id "${blockId}"`, blockId);
    }
    blockIds.add(blockId);

    // Collect labels in this block
    const labels = new Set();
    let hasRet = false;

    for (const inst of block.instructions) {
      // Check known ops
      if (!KNOWN_OPS.has(inst.op)) {
        error(`Unknown instruction op "${inst.op}"`, blockId, inst.line);
      }

      // Collect labels
      if (inst.op === 'label') {
        const labelName = inst.label || inst.args?.[0];
        if (labels.has(labelName)) {
          error(`Duplicate label ":${labelName}" in block "${blockId}"`, blockId, inst.line);
        }
        labels.add(labelName);
      }

      // Track ret
      if (inst.op === 'ret') hasRet = true;

      // Track call targets
      if (inst.op === 'call') {
        const target = inst.args?.[0];
        if (target) referencedBlocks.add(target);
      }
    }

    // Check branch targets reference valid labels
    for (const inst of block.instructions) {
      if (BRANCH_OPS.has(inst.op)) {
        const targetLabel = inst.op === 'br' ? inst.args?.[0] : inst.args?.[1];
        const cleanLabel = targetLabel?.replace(/^:/, '');
        if (cleanLabel && !labels.has(cleanLabel)) {
          error(`Branch to non-existent label ":${cleanLabel}" in block "${blockId}"`, blockId, inst.line);
        }
      }
    }

    // Every block should have at least one ret
    if (!hasRet) {
      warning(`Block "${blockId}" has no ret instruction`, blockId);
    }
  }

  // Check call targets exist
  for (const target of referencedBlocks) {
    if (!blockIds.has(target)) {
      error(`Call to non-existent block "${target}"`);
    }
  }

  // Warn about unused non-exported blocks
  const exportedSet = new Set(mod.exports || []);
  for (const blockId of blockIds) {
    if (!exportedSet.has(blockId) && !referencedBlocks.has(blockId)) {
      warning(`Block "${blockId}" is neither exported nor called`);
    }
  }

  return { valid: diagnostics.filter(d => d.type === 'error').length === 0, diagnostics };
}
