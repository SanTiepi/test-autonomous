import rawVariant from "../variants/source_raw.mjs";
import structuredVariant from "../variants/source_structured.mjs";
import irVariant from "../variants/candidate_ir.mjs";

const VARIANTS = [rawVariant, structuredVariant, irVariant];

export function getVariants(selectedIds = null) {
  if (!selectedIds || selectedIds.length === 0) return VARIANTS;
  return selectedIds.map((id) => {
    const found = VARIANTS.find((variant) => variant.id === id);
    if (!found) {
      throw new Error(`Unknown benchmark variant "${id}"`);
    }
    return found;
  });
}

export function listVariantIds() {
  return VARIANTS.map((variant) => variant.id);
}
