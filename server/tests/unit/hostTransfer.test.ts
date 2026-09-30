/**
 * Host transfer (`testing-strategy.md` section 2, "Host transfer").
 */

import { describe, expect, it } from 'vitest';
import { HostTransferService } from '../../src/game/hostTransferService.js';
import { makeAggregate, makeMember } from '../helpers/fixtures.js';

const host = new HostTransferService();

describe('HostTransferService', () => {
  it('selects the earliest joinedAt among connected members', () => {
    const members = [
      makeMember({ playerId: 'p7', joinedAt: 700, isConnected: true }),
      makeMember({ playerId: 'p2', joinedAt: 200, isConnected: true }),
      makeMember({ playerId: 'p3', joinedAt: 100, isConnected: false }),
    ];
    expect(host.selectNextHost(members)).toBe('p2');
  });

  it('breaks a joinedAt tie by lowest playerId', () => {
    const members = [
      makeMember({ playerId: 'pz', joinedAt: 500, isConnected: true }),
      makeMember({ playerId: 'pa', joinedAt: 500, isConnected: true }),
    ];
    expect(host.selectNextHost(members)).toBe('pa');
  });

  it('leaves the role assigned when nobody is connected', () => {
    const members = [makeMember({ playerId: 'p1', isConnected: false })];
    expect(host.selectNextHost(members)).toBeNull();
    const aggregate = makeAggregate({ hostPlayerId: 'p1' });
    expect(host.applyTransfer(aggregate, members)).toBeNull();
    expect(aggregate.hostPlayerId).toBe('p1');
  });

  it('does not transfer when the current host is still the right answer', () => {
    const aggregate = makeAggregate({ hostPlayerId: 'p1' });
    const members = [makeMember({ playerId: 'p1', joinedAt: 100 })];
    expect(host.applyTransfer(aggregate, members)).toBeNull();
    expect(aggregate.hostPlayerId).toBe('p1');
  });

  it('applies its rule positionally - the no-revert guard belongs to the caller', () => {
    // The service answers "who should host, given this roster" and nothing
    // else. "No revert on the old host's return" (FR-026) is enforced by
    // `ConnectionRegistry`, which only consults this service when the
    // *current* host's presence ends, so a returning old host cannot trigger a
    // transfer at all. F-07 covers that at integration level.
    const aggregate = makeAggregate({ hostPlayerId: 'p2' });
    const members = [
      makeMember({ playerId: 'p1', joinedAt: 100, isConnected: true }),
      makeMember({ playerId: 'p2', joinedAt: 200, isConnected: true }),
    ];
    expect(host.applyTransfer(aggregate, members)).toBe('p1');
  });
});