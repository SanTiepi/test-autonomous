import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hiddenSynergies,
  listSynergiesFor,
  ecosystemWantsToBecome,
} from '../src/ecosystem_synergies.mjs';

describe('ecosystem synergies registry', () => {
  it('captures five hidden synergies as executable data', () => {
    assert.equal(hiddenSynergies.length, 5);
  });

  it('keeps every synergy machine-checkable', () => {
    for (const synergy of hiddenSynergies) {
      assert.ok(typeof synergy.id === 'string' && synergy.id.length > 0);
      assert.ok(Array.isArray(synergy.projects) && synergy.projects.length >= 2);
      assert.ok(typeof synergy.mechanism === 'string' && synergy.mechanism.length > 40);
      assert.ok(typeof synergy.creates === 'string' && synergy.creates.length > 20);
      assert.ok(Array.isArray(synergy.evidence) && synergy.evidence.length >= 2);
    }
  });

  it('supports project lookup', () => {
    const swissBuildingSynergies = listSynergiesFor('SwissBuilding');
    assert.ok(swissBuildingSynergies.length >= 3);
    assert.ok(swissBuildingSynergies.some((entry) => entry.id === 'proof_kernel'));
  });

  it('exposes one convergence pattern from the same registry', () => {
    const summary = ecosystemWantsToBecome();
    assert.equal(summary.synergyCount, 5);
    assert.ok(summary.projectsCovered.includes('WorldEngine'));
    assert.ok(summary.pattern.includes('proof-first simulation operating layer'));
  });
});
