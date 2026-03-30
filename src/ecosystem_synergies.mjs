export const hiddenSynergies = [
  {
    id: 'pre_publish_labor_simulator',
    projects: ['WorldEngine', 'FreeTime'],
    mechanism: 'Compile roster, legal regime, site constraints, and manager policies into WorldEngine scenarios with employee, manager, inspector, and payroll agents before schedule publication.',
    creates: 'A pre-publication labor risk simulator that predicts violations, payroll exceptions, and manager overload before they hit reality.',
    evidence: [
      'C:\\PROJET IA\\WorldEngine\\CLAUDE.md',
      'C:\\PROJET IA\\FreeTime\\FreeTime_Product_Decision_Brief.md',
      'C:\\PROJET IA\\FreeTime\\FreeTime_Market_Leadership_Blueprint_2026.md',
    ],
  },
  {
    id: 'pre_sample_blind_spot_engine',
    projects: ['FRACTURE', 'WorldEngine', 'Batiscan-V4', 'SwissBuilding'],
    mechanism: 'Turn FRACTURE blind-spot prompts, Batiscan prebrief and benchmark data, and SwissBuilding evidence state into WorldEngine monte-carlo runs that stress-test a sampling plan before fieldwork starts.',
    creates: 'A pre-terrain anti-miss engine that scores sampling quality, likely missed pollutants, and legal exposure before the first sample is taken.',
    evidence: [
      'C:\\PROJET IA\\test-autonomous\\docs\\VISION_SWISSBUILDING.md',
      'C:\\PROJET IA\\WorldEngine\\CLAUDE.md',
      'C:\\PROJET IA\\Batiscan-V4\\FROZEN.md',
      'C:\\PROJET IA\\SwissBuilding\\CLAUDE.md',
    ],
  },
  {
    id: 'proof_kernel',
    projects: ['Batiscan-V4', 'SwissBuilding', 'FreeTime', 'benoit-v2', 'benoit-ecosystem'],
    mechanism: 'Normalize every operational claim into a hashed proof object with sources, expiry, actor chain, and counter-evidence hooks, then use Benoit proof and trust tooling to verify and watch those objects across domains.',
    creates: 'A Swiss proof kernel shared by building diagnostics, building readiness, labor compliance, inspection packs, and future audit-grade workflows.',
    evidence: [
      'C:\\PROJET IA\\Batiscan-V4\\FROZEN.md',
      'C:\\PROJET IA\\SwissBuilding\\docs\\vision-100x-master-brief.md',
      'C:\\PROJET IA\\FreeTime\\FreeTime_Product_Decision_Brief.md',
      'C:\\PROJET IA\\benoit-ecosystem\\CLAUDE.md',
      'C:\\PROJET IA\\test-autonomous\\src\\mcl\\BENOIT.md',
    ],
  },
  {
    id: 'portfolio_autonomy_governor',
    projects: ['OrbitPilot', 'PulseOps', 'Duo Claude/Codex', 'FRACTURE'],
    mechanism: 'Feed PulseOps repo health, FRACTURE-discovered blind spots, and cross-project goals into OrbitPilot so the duo control plane can choose the next repo, next task, and next risk to attack with adaptive thresholds.',
    creates: 'A portfolio governor that allocates Robin attention and agent cycles across repos by leverage instead of by inbox noise.',
    evidence: [
      'C:\\PROJET IA\\OrbitPilot\\CLAUDE.md',
      'C:\\PROJET IA\\PulseOps\\CLAUDE.md',
      'C:\\PROJET IA\\test-autonomous\\CLAUDE.md',
      'C:\\PROJET IA\\test-autonomous\\src\\duo.mjs',
      'C:\\PROJET IA\\test-autonomous\\docs\\VISION_SWISSBUILDING.md',
    ],
  },
  {
    id: 'dossier_to_negotiation_compiler',
    projects: ['NegotiateAI', 'Batiscan-V4', 'SwissBuilding', 'FreeTime'],
    mechanism: 'Convert a diagnostic package, authority dossier, or labor proof pack into a negotiation brief so NegotiateAI can simulate owner, contractor, insurer, authority, or inspector pushback before the real call happens.',
    creates: 'A dossier-to-conversation compiler that turns static proof into rehearsed leverage, objection handling, and safer high-stakes decisions.',
    evidence: [
      'C:\\PROJET IA\\NegotiateAI\\CLAUDE.md',
      'C:\\PROJET IA\\Batiscan-V4\\FROZEN.md',
      'C:\\PROJET IA\\SwissBuilding\\docs\\projects\\batiscan-swissbuilding-cross-product-operator-stories-2026-03-25.md',
      'C:\\PROJET IA\\FreeTime\\FreeTime_Product_Decision_Brief.md',
    ],
  },
];

export const globalConvergencePattern =
  'This ecosystem wants to become a proof-first simulation operating layer: observe reality, detect blind spots, simulate consequences, negotiate action, and preserve the resulting truth as executable evidence.';

export function listSynergiesFor(project) {
  return hiddenSynergies.filter((synergy) => synergy.projects.includes(project));
}

export function ecosystemWantsToBecome() {
  return {
    synergyCount: hiddenSynergies.length,
    projectsCovered: [...new Set(hiddenSynergies.flatMap((synergy) => synergy.projects))].sort(),
    pattern: globalConvergencePattern,
  };
}
