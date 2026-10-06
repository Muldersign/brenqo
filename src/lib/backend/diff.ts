import type { AppData } from '../types';
import { ENTITY_KEYS, ENTITY_TABLES, type EntityKey } from './tables';

export interface TableChanges {
  key: EntityKey | 'organizations';
  table: string;
  upserts: { id: string; organization_id?: string; data: unknown }[];
  deletes: string[];
}

/**
 * What changed between two snapshots of the store. The store never mutates
 * records in place, so a changed object reference means a changed record.
 * Organizations come first (other rows reference them).
 */
export function diffData(prev: AppData, next: AppData): TableChanges[] {
  const out: TableChanges[] = [];
  const keys: (EntityKey | 'organizations')[] = ['organizations', ...ENTITY_KEYS];
  for (const key of keys) {
    const a = prev[key] as { id: string; organizationId?: string }[];
    const b = next[key] as { id: string; organizationId?: string }[];
    if (a === b) continue;
    const before = new Map(a.map((r) => [r.id, r]));
    const upserts: TableChanges['upserts'] = [];
    for (const r of b) {
      if (before.get(r.id) === r) continue;
      upserts.push(key === 'organizations' ? { id: r.id, data: r } : { id: r.id, organization_id: r.organizationId, data: r });
    }
    const ids = new Set(b.map((r) => r.id));
    const deletes = a.filter((r) => !ids.has(r.id)).map((r) => r.id);
    if (upserts.length || deletes.length) {
      out.push({ key, table: key === 'organizations' ? 'organizations' : ENTITY_TABLES[key as EntityKey], upserts, deletes });
    }
  }
  return out;
}
