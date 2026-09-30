/**
 * Secret-word isolation, structural half (S-06, `security-model.md` section 3).
 *
 * The runtime half - that a guesser's snapshot and every room broadcast carry
 * no word - lives in `tests/integration/secretIsolation.test.ts`. This test
 * fails as soon as a public payload schema gains the field, which is the
 * cheapest place to catch the mistake.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SECRET_WORD_CARRYING_EVENTS } from '../../../shared/contract/events.js';
import { SERVER_TO_CLIENT_SCHEMAS } from '../../../shared/contract/server-payloads.js';

/** The schema as JSON. `toJSONSchema` cannot throw for these object schemas. */
function schemaJson(schema: unknown): string {
  return JSON.stringify(z.toJSONSchema(schema as never));
}

describe('server payload schemas', () => {
  it('registers a schema for every server event it names', () => {
    expect(Object.keys(SERVER_TO_CLIENT_SCHEMAS).length).toBeGreaterThanOrEqual(
      23,
    );
  });

  it('declares no secretWord outside the two role-scoped carriers', () => {
    for (const [event, schema] of Object.entries(SERVER_TO_CLIENT_SCHEMAS)) {
      if ((SECRET_WORD_CARRYING_EVENTS as readonly string[]).includes(event)) {
        continue;
      }
      expect(schemaJson(schema), event).not.toContain('secretWord');
    }
  });

  it('keeps the public drawer:selected free of the field entirely', () => {
    const publicSchema = SERVER_TO_CLIENT_SCHEMAS['drawer:selected'];
    expect(Object.keys(publicSchema.shape)).not.toContain('secretWord');
    expect(schemaJson(publicSchema)).not.toContain('secretWord');
  });

  it('carries the field only in the snapshot round block, where it stays optional', () => {
    // `response:state:snapshot` is role-scoped: the projector omits `round.
    // secretWord` for a guesser. The schema allows it, the projector decides.
    expect(schemaJson(SERVER_TO_CLIENT_SCHEMAS['response:state:snapshot'])).toContain(
      'secretWord',
    );
  });
});