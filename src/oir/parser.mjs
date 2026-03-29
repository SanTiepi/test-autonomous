// OIR Parser — stub (will be replaced by full implementation)
// Parses OIR source text into a structured module object.

/**
 * @param {string} source
 * @returns {{id:string, version:string, exports:string[], state:any[], blocks:Map, tests:any[], errors:string[]}}
 */
export function parseOir(source) {
  const lines = source.split('\n');
  const errors = [];
  let id = '';
  let version = '';
  const exports_ = [];
  const state = [];
  const blocks = new Map();
  const tests = [];

  let currentBlock = null;
  let currentBlockId = null;
  let currentTest = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue;
    }

    // Module declaration
    if (trimmed.startsWith('mod ')) {
      const parts = trimmed.split(/\s+/);
      id = parts[1] || '';
      version = (parts[2] || '').replace(/^v/, '');
      continue;
    }

    // Exports
    if (trimmed.startsWith('exp ')) {
      const parts = trimmed.split(/\s+/);
      exports_.push(...parts.slice(1));
      continue;
    }

    // State
    if (trimmed.startsWith('st ')) {
      const parts = trimmed.split(/\s+/);
      state.push(...parts.slice(1));
      continue;
    }

    // Block declaration
    if (trimmed.startsWith('blk ')) {
      if (currentBlock && currentBlockId) {
        blocks.set(currentBlockId, currentBlock);
      }
      currentTest = null;
      const parsed = parseBlockHeader(trimmed);
      currentBlockId = parsed.id;
      currentBlock = {
        id: parsed.id,
        inputs: parsed.inputs,
        outputs: parsed.outputs,
        effects: parsed.effects,
        instructions: []
      };
      continue;
    }

    // Test declaration
    if (trimmed.startsWith('test ')) {
      if (currentBlock && currentBlockId) {
        blocks.set(currentBlockId, currentBlock);
        currentBlock = null;
        currentBlockId = null;
      }
      const desc = trimmed.slice(5).replace(/^["']|["']$/g, '');
      currentTest = { description: desc, instructions: [] };
      tests.push(currentTest);
      continue;
    }

    // Label
    if (trimmed.startsWith(':')) {
      const label = trimmed.slice(1);
      if (currentBlock) {
        currentBlock.instructions.push({ op: 'label', args: [label], dst: null, label, line: i + 1 });
      }
      continue;
    }

    // Instruction
    const inst = parseInstruction(trimmed, i + 1);
    if (inst) {
      if (currentBlock) {
        currentBlock.instructions.push(inst);
      } else if (currentTest) {
        currentTest.instructions.push(inst);
      }
    }
  }

  if (currentBlock && currentBlockId) {
    blocks.set(currentBlockId, currentBlock);
  }

  // Basic validation: must have mod
  if (!id) {
    errors.push('Missing module declaration (mod <id> v<version>)');
  }

  return { id, version, exports: exports_, state, blocks, tests, errors };
}

function parseBlockHeader(line) {
  // blk <id> (<inputs>) -> (<outputs>) [!<effect> ...]
  const match = line.match(/^blk\s+(\w+)\s*\(([^)]*)\)\s*->\s*\(([^)]*)\)\s*(.*)/);
  if (!match) {
    // Try simpler form
    const simple = line.match(/^blk\s+(\w+)\s*\(([^)]*)\)/);
    if (simple) {
      return {
        id: simple[1],
        inputs: simple[2].trim() ? simple[2].trim().split(/\s+/) : [],
        outputs: [],
        effects: []
      };
    }
    return { id: 'unknown', inputs: [], outputs: [], effects: [] };
  }

  const effects = [];
  const rest = match[4].trim();
  if (rest) {
    const parts = rest.split(/\s+/);
    for (const p of parts) {
      if (p.startsWith('!')) effects.push(p.slice(1));
    }
  }

  return {
    id: match[1],
    inputs: match[2].trim() ? match[2].trim().split(/\s+/) : [],
    outputs: match[3].trim() ? match[3].trim().split(/\s+/) : [],
    effects
  };
}

function parseInstruction(line, lineNum) {
  const parts = tokenize(line);
  if (parts.length === 0) return null;

  const op = parts[0];

  // Instructions with no dst: st_set, st_del, br, brt, brf, ret
  const noDstOps = new Set(['br', 'ret']);
  // Instructions where first arg after op is dst, but for st_set/st_del the "dst" is the store
  const storeTargetOps = new Set(['st_set', 'st_del']);

  if (op === 'br') {
    return { op, args: [parts[1]], dst: null, label: null, line: lineNum };
  }

  if (op === 'brt' || op === 'brf') {
    return { op, args: [parts[1], parts[2]], dst: null, label: null, line: lineNum };
  }

  if (op === 'ret') {
    if (parts.length > 1) {
      return { op, args: [parts[1]], dst: parts[1], label: null, line: lineNum };
    }
    return { op, args: [], dst: null, label: null, line: lineNum };
  }

  if (storeTargetOps.has(op)) {
    // st_set store key val / st_del store key
    return { op, args: parts.slice(2), dst: parts[1], label: null, line: lineNum };
  }

  // All other ops: <op> <dst> [args...]
  const dst = parts[1] || null;
  const args = parts.slice(2);
  return { op, args, dst, label: null, line: lineNum };
}

function tokenize(line) {
  const tokens = [];
  let i = 0;
  const s = line.trim();
  while (i < s.length) {
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }
    if (s[i] === '"') {
      // Quoted string - include quotes
      let j = i + 1;
      while (j < s.length && s[j] !== '"') {
        if (s[j] === '\\') j++;
        j++;
      }
      tokens.push(s.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    let j = i;
    while (j < s.length && s[j] !== ' ' && s[j] !== '\t') j++;
    tokens.push(s.slice(i, j));
    i = j;
  }
  return tokens;
}
