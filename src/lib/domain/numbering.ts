/** `2026-` + 38 → `2026-038`; `VZ-2026-` + 2 → `VZ-2026-002`. */
export function formatDocNumber(prefix: string, n: number, pad = 3) {
  return `${prefix}${String(n).padStart(pad, '0')}`;
}

/** Replace `{jaar}` in a prefix with the year, so numbering can restart yearly. */
export function resolvePrefix(prefix: string, year: number) {
  return prefix.replace(/\{jaar\}/gi, String(year));
}
