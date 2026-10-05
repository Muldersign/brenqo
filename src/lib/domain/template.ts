/** Fill `[naam]`-style placeholders. Unknown placeholders are left as they are. */
export function fillTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\[([a-zà-ÿ ]+)\]/gi, (m, key: string) => {
    const v = vars[key.toLowerCase().trim()];
    return v === undefined ? m : v;
  });
}
