/**
 * Drawer selection (`testing-strategy.md` section 2, "Drawer selection").
 */

import { describe, expect, it } from 'vitest';
import {
  eligibleDrawerPool,
  eligibleGuessers,
  selectDrawer,
} from '../../src/game/drawerSelector.js';
import { createSeededIdSource } from '../../src/game/ids.js';
import { makeMember } from '../helpers/fixtures.js';

describe('eligibleDrawerPool', () => {
  it('excludes the previous drawer while another connected player exists', () => {
    const members = [
      makeMember({ playerId: 'p1' }),
      makeMember({ playerId: 'p2' }),
    ];
    expect(eligibleDrawerPool(members, 'p1')).toEqual(['p2']);
  });

  it('falls back to the whole connected roster when nobody else is eligible', () => {
    const members = [
      makeMember({ playerId: 'p1' }),
      makeMember({ playerId: 'p2', isConnected: false }),
    ];
    expect(eligibleDrawerPool(members, 'p1')).toEqual(['p1']);
  });

  it('excludes disconnected members', () => {
    const members = [
      makeMember({ playerId: 'p1', isConnected: false }),
      makeMember({ playerId: 'p2' }),
    ];
    expect(eligibleDrawerPool(members, null)).toEqual(['p2']);
  });
});

describe('selectDrawer', () => {
  it('never selects the previous drawer while another eligible player exists', () => {
    const members = [
      makeMember({ playerId: 'p1' }),
      makeMember({ playerId: 'p2' }),
      makeMember({ playerId: 'p3' }),
    ];
    for (let seed = 0; seed < 50; seed += 1) {
      const picked = selectDrawer(members, 'p1', createSeededIdSource(seed));
      expect(picked).not.toBe('p1');
    }
  });

  it('still selects the only eligible player', () => {
    const members = [makeMember({ playerId: 'p1' })];
    expect(selectDrawer(members, 'p1', createSeededIdSource(1))).toBe('p1');
  });

  it('returns null when nobody is connected', () => {
    const members = [makeMember({ playerId: 'p1', isConnected: false })];
    expect(selectDrawer(members, null, createSeededIdSource(1))).toBeNull();
  });

  it('is uniform over the eligible pool for a fixed seed sequence', () => {
    const members = [
      makeMember({ playerId: 'a' }),
      makeMember({ playerId: 'b' }),
      makeMember({ playerId: 'c' }),
      makeMember({ playerId: 'd' }),
    ];
    const counts = new Map<string, number>();
    const ids = createSeededIdSource(7);
    for (let i = 0; i < 4000; i += 1) {
      const picked = selectDrawer(members, null, ids);
      if (picked !== null) counts.set(picked, (counts.get(picked) ?? 0) + 1);
    }
    expect(counts.size).toBe(4);
    for (const count of counts.values()) {
      // 1000 expected each; allow a wide band - this is a smoke test for a
      // biased selector, not a statistical proof.
      expect(count).toBeGreaterThan(800);
      expect(count).toBeLessThan(1200);
    }
  });
});

describe('eligibleGuessers', () => {
  it('is the connected roster minus the drawer', () => {
    const members = [
      makeMember({ playerId: 'p1' }),
      makeMember({ playerId: 'p2' }),
      makeMember({ playerId: 'p3', isConnected: false }),
    ];
    expect(eligibleGuessers(members, 'p1').map((m) => m.playerId)).toEqual(['p2']);
  });
});