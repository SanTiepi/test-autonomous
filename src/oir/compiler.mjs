// OIR Compiler — compiles parsed OIR modules to JavaScript
// @ts-check

/**
 * @param {object} mod - parsed OIR module from parseOir
 * @returns {{code: string, sourceMap: null}}
 */
export function compileOirToJs(mod) {
  const lines = [];
  let needsCrypto = false;

  // Check if any block uses uuid
  for (const [, blk] of mod.blocks) {
    for (const inst of blk.instructions) {
      if (inst.op === 'uuid') { needsCrypto = true; break; }
    }
    if (needsCrypto) break;
  }

  lines.push(`// OIR compiled: ${mod.id} v${mod.version}`);
  if (needsCrypto) {
    lines.push(`import { randomUUID } from "node:crypto";`);
  }

  // State declarations
  if (mod.state && mod.state.length > 0) {
    for (const s of mod.state) {
      const name = typeof s === 'string' ? s.split(':')[0] : s.name || s;
      lines.push(`const ${name} = new Map();`);
    }
  }

  // Compile blocks
  const exportSet = new Set(mod.exports || []);
  for (const [blockId, blk] of mod.blocks) {
    const fn = compileBlock(blockId, blk, exportSet.has(blockId));
    lines.push(fn);
  }

  return { code: lines.join('\n'), sourceMap: null };
}

function compileBlock(blockId, blk, isExported) {
  const inputs = blk.inputs || [];
  const instructions = blk.instructions || [];

  // Build label map: label name -> case number
  const labelMap = new Map();
  let caseNum = 1;
  for (const inst of instructions) {
    if (inst.op === 'label') {
      labelMap.set(inst.label || inst.args[0], caseNum++);
    }
  }

  const hasLabels = labelMap.size > 0;

  // Collect all dst registers (exclude store targets from st_set/st_del and labels)
  const storeTargetOps = new Set(['st_set', 'st_del']);
  const regs = new Set();
  for (const inst of instructions) {
    if (inst.dst && !inputs.includes(inst.dst) && inst.op !== 'label' && !storeTargetOps.has(inst.op)) {
      regs.add(inst.dst);
    }
  }

  const prefix = isExported ? 'export function' : 'function';
  const lines = [];
  lines.push(`${prefix} ${blockId}(${inputs.join(', ')}) {`);

  // Declare registers
  if (regs.size > 0) {
    lines.push(`  let ${[...regs].join(', ')};`);
  }

  if (hasLabels) {
    lines.push(`  let _pc = 0;`);
    lines.push(`  _loop: while (true) { switch (_pc) {`);
    lines.push(`    case 0:`);

    for (const inst of instructions) {
      if (inst.op === 'label') {
        const label = inst.label || inst.args[0];
        lines.push(`    case ${labelMap.get(label)}: // :${label}`);
      } else {
        const compiled = compileInstruction(inst, labelMap, inputs);
        lines.push(`      ${compiled}`);
      }
    }

    lines.push(`  }}`);
  } else {
    for (const inst of instructions) {
      const compiled = compileInstruction(inst, labelMap, inputs);
      lines.push(`  ${compiled}`);
    }
  }

  lines.push(`}`);
  return lines.join('\n');
}

function compileLiteral(val) {
  if (val === 'nil') return 'null';
  if (val === 'true') return 'true';
  if (val === 'false') return 'false';
  if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
    // Already quoted — pass through as JS string literal
    return val;
  }
  const num = Number(val);
  if (!isNaN(num) && val !== '') return String(num);
  // unquoted non-keyword non-number — treat as string literal
  return JSON.stringify(val);
}

function isRegisterName(name) {
  // Register names are identifiers: t0, t1, r0, body, todo, etc.
  // NOT: quoted strings, keywords (nil/true/false), numbers
  if (typeof name !== 'string') return false;
  if (name.startsWith('"')) return false; // quoted string literal
  if (name === 'nil' || name === 'true' || name === 'false') return false;
  if (!isNaN(Number(name)) && name !== '') return false;
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function compileInstruction(inst, labelMap, inputs) {
  const { op, args, dst } = inst;

  switch (op) {
    case 'lit': {
      const val = args[0];
      return `${dst} = ${compileLiteral(val)};`;
    }
    case 'get': {
      const [src, key] = args;
      // Key may already be quoted from parser (e.g. "title") or be a register name
      if (key && key.startsWith('"') && key.endsWith('"')) {
        return `${dst} = ${src}[${key}];`; // already quoted
      }
      return `${dst} = ${src}[${isRegisterName(key) ? key : JSON.stringify(key)}];`;
    }
    case 'set': {
      const [key, val] = args;
      const keyExpr = (key && key.startsWith('"') && key.endsWith('"')) ? key
        : isRegisterName(key) ? key : JSON.stringify(key);
      return `${dst}[${keyExpr}] = ${isRegisterName(val) ? val : compileLiteral(val)};`;
    }
    case 'obj': {
      if (args.length === 0) {
        return `${dst} = {};`;
      }
      const pairs = args.map(pair => {
        const colonIdx = pair.indexOf(':');
        const k = pair.slice(0, colonIdx);
        const v = pair.slice(colonIdx + 1);
        const val = isRegisterName(v) ? v : compileLiteral(v);
        return `${k}: ${val}`;
      });
      return `${dst} = {${pairs.join(', ')}};`;
    }
    case 'arr': {
      const items = args.map(a => isRegisterName(a) ? a : compileLiteral(a));
      return `${dst} = [${items.join(', ')}];`;
    }
    case 'mov': {
      const [src] = args;
      return `${dst} = ${src};`;
    }
    case 'len': {
      const [src] = args;
      return `${dst} = typeof ${src} === "string" ? ${src}.length : ${src}?.size ?? Object.keys(${src}).length;`;
    }
    case 'trim': {
      const [src] = args;
      return `${dst} = String(${src}).trim();`;
    }
    case 'eq': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} === ${bVal});`;
    }
    case 'neq': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} !== ${bVal});`;
    }
    case 'gt': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} > ${bVal});`;
    }
    case 'lt': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} < ${bVal});`;
    }
    case 'not': {
      const [src] = args;
      return `${dst} = (!${src});`;
    }
    case 'and': {
      const [a, b] = args;
      return `${dst} = (${a} && ${b});`;
    }
    case 'or': {
      const [a, b] = args;
      return `${dst} = (${a} || ${b});`;
    }
    case 'add': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} + ${bVal});`;
    }
    case 'sub': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} - ${bVal});`;
    }
    case 'mul': {
      const [a, b] = args;
      const bVal = isRegisterName(b) ? b : compileLiteral(b);
      return `${dst} = (${a} * ${bVal});`;
    }
    case 'is': {
      const [src, type] = args;
      const checks = {
        str: `typeof ${src} === "string"`,
        num: `typeof ${src} === "number"`,
        bool: `typeof ${src} === "boolean"`,
        nil: `(${src} == null)`,
        obj: `(typeof ${src} === "object" && !Array.isArray(${src}))`,
        arr: `Array.isArray(${src})`,
      };
      return `${dst} = (${checks[type] || 'false'});`;
    }
    case 'cat': {
      const parts = args.map(a => `String(${isRegisterName(a) ? a : compileLiteral(a)})`);
      return `${dst} = ${parts.join(' + ')};`;
    }
    case 'lower': {
      const [src] = args;
      return `${dst} = String(${src}).toLowerCase();`;
    }
    case 'includes': {
      const [haystack, needle] = args;
      return `${dst} = String(${haystack}).includes(${isRegisterName(needle) ? needle : compileLiteral(needle)});`;
    }
    case 'push': {
      const [val] = args;
      return `${dst}.push(${isRegisterName(val) ? val : compileLiteral(val)});`;
    }
    case 'br': {
      const label = args[0].replace(/^:/, '');
      const pc = labelMap.get(label);
      return `_pc = ${pc}; continue _loop;`;
    }
    case 'brt': {
      const cond = args[0];
      const label = args[1].replace(/^:/, '');
      const pc = labelMap.get(label);
      return `if (${cond}) { _pc = ${pc}; continue _loop; }`;
    }
    case 'brf': {
      const cond = args[0];
      const label = args[1].replace(/^:/, '');
      const pc = labelMap.get(label);
      return `if (!${cond}) { _pc = ${pc}; continue _loop; }`;
    }
    case 'ret': {
      if (dst) return `return ${dst};`;
      if (args.length > 0) return `return ${args[0]};`;
      return `return;`;
    }
    case 'call': {
      const [blk, ...callArgs] = args;
      return `${dst} = ${blk}(${callArgs.join(', ')});`;
    }
    case 'st_get': {
      const [store, key] = args;
      return `${dst} = ${store}.get(${isRegisterName(key) ? key : compileLiteral(key)});`;
    }
    case 'st_set': {
      // st_set store key val — no dst
      const target = dst; // store name
      const [key, val] = args;
      return `${target}.set(${isRegisterName(key) ? key : compileLiteral(key)}, ${isRegisterName(val) ? val : compileLiteral(val)});`;
    }
    case 'st_del': {
      const target = dst;
      const [key] = args;
      return `${target}.delete(${isRegisterName(key) ? key : compileLiteral(key)});`;
    }
    case 'st_has': {
      const [store, key] = args;
      return `${dst} = ${store}.has(${isRegisterName(key) ? key : compileLiteral(key)});`;
    }
    case 'st_vals': {
      const [store] = args;
      return `${dst} = [...${store}.values()];`;
    }
    case 'now': {
      return `${dst} = Date.now();`;
    }
    case 'uuid': {
      return `${dst} = randomUUID();`;
    }
    case 'emit': {
      const [status, data] = args;
      const statusVal = isRegisterName(status) ? status : `Number(${compileLiteral(status)}) || ${compileLiteral(status)}`;
      const dataVal = isRegisterName(data) ? data : compileLiteral(data);
      return `${dst} = {status: ${statusVal}, data: ${dataVal}};`;
    }
    case 'label': {
      // handled in compileBlock
      return '';
    }
    default:
      return `// unknown op: ${op}`;
  }
}
