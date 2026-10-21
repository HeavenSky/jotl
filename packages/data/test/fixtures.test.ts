// 用共享样例验收 getDefaults(defaults.json)与 validate(valid/ 全部通过, invalid/ 的错误按 {code, pointer} 集合相等).
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { listFixtures, readFixture, sortByKey } from '../../../test-utils/fixtures.js';
import { getDefaults, validate } from '../src/index.js';

for (const name of listFixtures()) {
  const fixture = readFixture(name);
  if (!fixture.hasSchema) continue;
  const schema = fixture.schema as JsonSchema;

  describe(name, () => {
    it('getDefaults 与 defaults.json 深度相等', () => {
      const result = getDefaults(schema);
      expect(result.diagnostics).toEqual([]);
      expect(result.value).toEqual(fixture.defaults);
    });

    for (const c of fixture.valid) {
      it(`valid/${c.name} 通过`, () => {
        const result = validate(schema, c.data);
        expect(result.diagnostics).toEqual([]);
        expect(result.value).toEqual({ valid: true });
      });
    }

    for (const c of fixture.invalid) {
      it(`invalid/${c.name} 的错误与期望集合相等`, () => {
        const result = validate(schema, c.data);
        expect(result.value).toEqual({ valid: false });
        const actual = result.diagnostics.map(d => ({
          code: d.code,
          pointer: d.location?.kind === 'pointer' ? d.location.pointer : undefined,
        }));
        expect(sortByKey(actual)).toEqual(sortByKey(c.errors ?? []));
        for (const d of result.diagnostics) {
          expect(d.severity).toBe('error');
          expect(d.message).not.toMatch(/\{\w+\}/);
        }
      });
    }
  });
}
