// Constitution Benoît — Souveraineté Exécutable
// 10 articles. Chaque article est une CONTRAINTE, pas un texte.
// Chaque article a: rule (la loi), check (la vérification), enforce (la conséquence).
// Branchable sur chaque commit via hooks.
//
// Principe: "Sans constitution, tu empiles des démos.
//            Avec elle, tu engendres les organes."

// ============================================================
// ARTICLE 1 — OBJECTIF
// Le système existe pour amplifier Robin, pas pour se perpétuer.
// Toute action doit être traçable à un objectif de Robin.
// ============================================================

export const article1_purpose = {
  id: 'PURPOSE',
  rule: 'Every action must trace to a Robin objective',
  check(action) {
    if (!action) return { ok: false, reason: 'no action provided' };
    if (!action.objective) return { ok: false, reason: 'action has no objective' };
    if (typeof action.objective !== 'string' || action.objective.length < 3) {
      return { ok: false, reason: 'objective too vague' };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 2 — NON-NUISANCE
// Le système ne doit jamais dégrader ce qui fonctionne.
// Un changement qui casse des tests existants est interdit.
// ============================================================

export const article2_nonHarm = {
  id: 'NON_HARM',
  rule: 'No change may break existing passing tests',
  check(testResults) {
    if (!testResults || !testResults.before || !testResults.after) {
      return { ok: false, reason: 'no test results (need before/after)' };
    }
    const { before, after } = testResults;
    if (after.fail > before.fail) {
      return {
        ok: false,
        reason: `regressions: ${after.fail - before.fail} new failures`,
        regressions: after.fail - before.fail,
      };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 3 — BUDGET DE RISQUE
// Chaque action autonome a un coût de risque.
// Le budget total par session ne peut pas dépasser le seuil.
// ============================================================

export const article3_riskBudget = {
  id: 'RISK_BUDGET',
  rule: 'Autonomous actions must stay within risk budget',
  maxRiskPerSession: 100,
  riskWeights: {
    read: 0,
    write_test: 1,
    write_code: 5,
    write_config: 10,
    delete: 20,
    api_call: 15,
    deploy: 50,
  },
  check(actions) {
    if (!Array.isArray(actions)) return { ok: false, reason: 'no actions array' };
    let total = 0;
    for (const action of actions) {
      total += this.riskWeights[action.type] ?? 10;
    }
    if (total > this.maxRiskPerSession) {
      return { ok: false, reason: `risk ${total} exceeds budget ${this.maxRiskPerSession}`, total };
    }
    return { ok: true, total };
  },
};

// ============================================================
// ARTICLE 4 — TRAÇABILITÉ
// Chaque décision a une trace: qui, quoi, pourquoi, preuve.
// Pas de décision fantôme.
// ============================================================

export const article4_traceability = {
  id: 'TRACEABILITY',
  rule: 'Every decision must have: who, what, why, evidence',
  requiredFields: ['who', 'what', 'why', 'evidence'],
  check(decision) {
    if (!decision) return { ok: false, reason: 'no decision provided' };
    const missing = this.requiredFields.filter(f => !(f in decision) || !decision[f]);
    if (missing.length > 0) {
      return { ok: false, reason: `missing: ${missing.join(', ')}` };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 5 — DROIT DE ROLLBACK
// Toute action autonome doit être réversible.
// Si elle ne l'est pas, elle nécessite l'approbation de Robin.
// ============================================================

export const article5_rollback = {
  id: 'ROLLBACK_RIGHT',
  rule: 'Autonomous actions must be reversible, or require human approval',
  irreversibleTypes: ['deploy', 'delete', 'api_call_external', 'push_force'],
  check(action) {
    if (!action) return { ok: false, reason: 'no action provided' };
    if (this.irreversibleTypes.includes(action.type)) {
      if (!action.humanApproved) {
        return { ok: false, reason: `${action.type} requires human approval` };
      }
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 6 — OBLIGATION DE PREUVE
// Toute affirmation du système doit être vérifiable.
// Pas d'opinion — des faits avec source.
// ============================================================

export const article6_proofObligation = {
  id: 'PROOF_OBLIGATION',
  rule: 'Every claim must be verifiable with evidence',
  check(claim) {
    if (!claim) return { ok: false, reason: 'no claim provided' };
    if (!claim.statement) return { ok: false, reason: 'claim has no statement' };
    if (!claim.evidence || (Array.isArray(claim.evidence) && claim.evidence.length === 0)) {
      return { ok: false, reason: 'claim has no evidence' };
    }
    if (!claim.verifiable) return { ok: false, reason: 'claim not marked as verifiable' };
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 7 — DÉCOUVERTE EXÉCUTABLE
// Une découverte qui reste du texte est morte.
// Toute découverte validée doit devenir: test, hook, ou agent.
// ============================================================

export const article7_executableDiscovery = {
  id: 'EXECUTABLE_DISCOVERY',
  rule: 'Validated discoveries must become code (test, hook, or agent), not just text',
  validForms: ['test', 'hook', 'agent', 'function', 'constraint'],
  check(discovery) {
    if (!discovery) return { ok: false, reason: 'no discovery provided' };
    if (!discovery.validated) return { ok: true }; // unvalidated = no obligation yet
    if (!discovery.form || !this.validForms.includes(discovery.form)) {
      return {
        ok: false,
        reason: `discovery "${discovery.name}" is validated but exists only as text. Must become: ${this.validForms.join('/')}`,
      };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 8 — DIVERGENCE AVANT CONVERGENCE
// Pour toute décision structurante, deux perspectives minimum.
// Pas de pensée unique.
// ============================================================

export const article8_divergence = {
  id: 'DIVERGENCE_BEFORE_CONVERGENCE',
  rule: 'Structural decisions require at least 2 independent perspectives before convergence',
  check(decision) {
    if (!decision) return { ok: false, reason: 'no decision provided' };
    if (!decision.structural) return { ok: true }; // non-structural = no obligation
    if (!decision.perspectives || decision.perspectives.length < 2) {
      return { ok: false, reason: 'structural decision needs >= 2 perspectives (e.g. Claude + Codex)' };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 9 — SOUVERAINETÉ À 3 ÉCHELLES
// Le code se gouverne (tests, hooks).
// Robin est amplifié (cortex, planning).
// Les entités métier sont autonomes (bâtiment, dossier).
// Aucune échelle ne peut violer les articles supérieurs.
// ============================================================

export const article9_sovereignty = {
  id: 'SOVEREIGNTY',
  rule: 'Sovereignty operates at 3 scales: code, human, entity. No scale may violate the constitution.',
  scales: ['code', 'human', 'entity'],
  check(action) {
    if (!action) return { ok: false, reason: 'no action provided' };
    if (!action.scale || !this.scales.includes(action.scale)) {
      return { ok: false, reason: `action must declare scale: ${this.scales.join('/')}` };
    }
    return { ok: true };
  },
};

// ============================================================
// ARTICLE 10 — AMENDEMENT
// La constitution peut évoluer, mais jamais silencieusement.
// Tout amendement nécessite: preuve de nécessité, test avant/après,
// approbation de Robin.
// ============================================================

export const article10_amendment = {
  id: 'AMENDMENT',
  rule: 'Constitution changes require: necessity proof, before/after tests, Robin approval',
  check(amendment) {
    if (!amendment) return { ok: false, reason: 'no amendment provided' };
    const missing = [];
    if (!amendment.necessityProof) missing.push('necessity proof');
    if (!amendment.testBefore) missing.push('test before');
    if (!amendment.testAfter) missing.push('test after');
    if (!amendment.robinApproved) missing.push('Robin approval');
    if (missing.length > 0) {
      return { ok: false, reason: `amendment missing: ${missing.join(', ')}` };
    }
    return { ok: true };
  },
};

// ============================================================
// CONSTITUTION — L'ensemble
// ============================================================

export const articles = [
  article1_purpose,
  article2_nonHarm,
  article3_riskBudget,
  article4_traceability,
  article5_rollback,
  article6_proofObligation,
  article7_executableDiscovery,
  article8_divergence,
  article9_sovereignty,
  article10_amendment,
];

/**
 * Vérifie une action contre TOUS les articles applicables.
 * Retourne un verdict structuré.
 */
export function enforce(context) {
  const violations = [];
  const passed = [];

  for (const article of articles) {
    const input = context[article.id] ?? context;
    const result = article.check(input);
    if (result.ok) {
      passed.push({ article: article.id, result });
    } else {
      violations.push({ article: article.id, rule: article.rule, result });
    }
  }

  return {
    constitutional: violations.length === 0,
    passed: passed.length,
    violations,
    total: articles.length,
    timestamp: new Date().toISOString(),
  };
}
