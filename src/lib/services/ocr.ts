'use client';

import type { VatRate } from '../types';
import { splitVat } from '../domain/calc';
import { todayISO, addDays } from '../domain/dates';

/** What the recogniser returns. Every field is a suggestion the user confirms. */
export interface OcrResult {
  supplierName: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: VatRate;
  iban: string;
  description: string;
  categoryHint: string;
  /** `ai`: read by the vision model; `demo`: simulated because no API key is configured. */
  engine: 'ai' | 'demo';
}

/** Downscale an image to a small JPEG preview so it fits comfortably in storage. */
export async function makePreview(file: File, maxSize = 720): Promise<string | undefined> {
  if (!file.type.startsWith('image/') || /heic|heif/i.test(file.type)) return undefined;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const DEMO: Record<string, Omit<OcrResult, 'date' | 'dueDate' | 'engine'>> = {
  praxis: { supplierName: 'Praxis', invoiceNumber: '', subtotal: 43.71, vatAmount: 9.18, total: 52.89, vatRate: 21, iban: '', description: 'Bevestigingsmateriaal, tape en schroeven', categoryHint: 'Materiaal' },
  adobe: { supplierName: 'Adobe', invoiceNumber: 'IEN2026004981', subtotal: 59.99, vatAmount: 12.6, total: 72.59, vatRate: 21, iban: 'IE29AIBK93115212345678', description: 'Creative Cloud – alle apps', categoryHint: 'Software' },
  cloud86: { supplierName: 'Cloud86', invoiceNumber: 'C86-2026-11873', subtotal: 20.62, vatAmount: 4.33, total: 24.95, vatRate: 21, iban: 'NL86INGB0002445588', description: 'Resellerhosting', categoryHint: 'Hosting' },
  kpn: { supplierName: 'KPN', invoiceNumber: '7004812235', subtotal: 52.85, vatAmount: 11.1, total: 63.95, vatRate: 21, iban: 'NL27INGB0000026500', description: 'Zakelijk mobiel + glasvezel', categoryHint: 'Telefoon & internet' },
  shell: { supplierName: 'Shell', invoiceNumber: '', subtotal: 58.84, vatAmount: 12.36, total: 71.2, vatRate: 21, iban: '', description: 'Euro 95, 36,4 liter', categoryHint: 'Brandstof' },
  canva: { supplierName: 'Canva', invoiceNumber: '04419-22871', subtotal: 9.91, vatAmount: 2.08, total: 11.99, vatRate: 21, iban: '', description: 'Canva Pro', categoryHint: 'Software' },
  meta: { supplierName: 'Meta', invoiceNumber: 'FBADS-5512-0091', subtotal: 82.64, vatAmount: 17.36, total: 100, vatRate: 21, iban: '', description: 'Advertenties Facebook & Instagram', categoryHint: 'Marketing' },
  ah: { supplierName: 'Albert Heijn', invoiceNumber: '', ...(() => { const s = splitVat(18.4, 9); return { subtotal: s.base, vatAmount: s.vat }; })(), total: 18.4, vatRate: 9, iban: '', description: 'Koffie en lunch klantoverleg', categoryHint: 'Representatie' },
};
const ROTATION = ['praxis', 'shell', 'ah'];
let rotation = 0;

function demoRecognize(fileName: string, kind: 'receipt' | 'invoice'): OcrResult {
  const name = fileName.toLowerCase();
  const key = Object.keys(DEMO).find((k) => name.includes(k)) ?? (kind === 'invoice' ? ['adobe', 'cloud86', 'kpn', 'canva', 'meta'][rotation++ % 5] : ROTATION[rotation++ % ROTATION.length]);
  const today = todayISO();
  return { ...DEMO[key], date: today, dueDate: kind === 'invoice' ? addDays(today, 14) : '', engine: 'demo' };
}

/**
 * Read a receipt or purchase invoice. Sends the file to `/api/ocr` (AI vision
 * when `ANTHROPIC_API_KEY` is configured on the server); without a key the
 * route answers 501 and we fall back to a realistic simulation so the flow
 * can still be tried end to end.
 */
export async function recognizeDocument(file: File, kind: 'receipt' | 'invoice'): Promise<OcrResult> {
  const started = Date.now();
  const minDuration = 1600; // give the scan animation a moment, it feels more trustworthy
  let result: OcrResult | null = null;
  try {
    const body = new FormData();
    body.append('file', file);
    body.append('kind', kind);
    const res = await fetch('/api/ocr', { method: 'POST', body });
    if (res.ok) result = { ...(await res.json()), engine: 'ai' } as OcrResult;
  } catch {
    /* offline or not configured: fall through to demo */
  }
  if (!result) result = demoRecognize(file.name, kind);
  const wait = minDuration - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return result;
}
