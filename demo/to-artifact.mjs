// Turn the Vite single-file output into an Artifact page body (the host adds doctype/head/body).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
// Inline JS may itself contain "<head>"-like strings, so cut on the outermost tags only.
const headStart = html.indexOf('<head>') + '<head>'.length;
const headEnd = html.lastIndexOf('</head>');
const head = html
  .slice(headStart, headEnd)
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '')
  .replace(/<title>[^<]*<\/title>/, '');
const out = `<title>Brenqo</title>\n<meta name="theme-color" content="#f6f6f8">\n${head.trim()}\n<div id="root"></div>\n`;
writeFileSync(new URL('./dist/brenqo.html', import.meta.url), out);
console.log('brenqo.html', (out.length / 1e6).toFixed(2), 'MB');
