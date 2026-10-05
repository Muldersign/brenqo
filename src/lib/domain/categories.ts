import type { Supplier, VatRate } from '../types';
import { normalize } from '../utils';

export const DEFAULT_CATEGORIES: { name: string; icon: string }[] = [
  { name: 'Software', icon: 'app-window' },
  { name: 'Hosting', icon: 'server' },
  { name: 'Marketing', icon: 'megaphone' },
  { name: 'Telefoon & internet', icon: 'smartphone' },
  { name: 'Kantoor', icon: 'briefcase' },
  { name: 'Reiskosten', icon: 'train-front' },
  { name: 'Brandstof', icon: 'fuel' },
  { name: 'Materiaal', icon: 'hammer' },
  { name: 'Inkoop', icon: 'package' },
  { name: 'Verzekeringen', icon: 'shield-check' },
  { name: 'Bankkosten', icon: 'landmark' },
  { name: 'Abonnementen', icon: 'repeat' },
  { name: 'Representatie', icon: 'coffee' },
  { name: 'Overig', icon: 'circle-dashed' },
];

/** Starting knowledge for suppliers we have never seen in this administration. */
const KEYWORDS: [string[], string][] = [
  [['adobe', 'figma', 'canva', 'notion', 'microsoft', 'google workspace', 'github', 'slack', 'jetbrains', 'apple'], 'Software'],
  [['cloud86', 'transip', 'vimexx', 'hostnet', 'strato', 'vercel', 'netlify', 'digitalocean', 'hetzner', 'mijndomein'], 'Hosting'],
  [['meta', 'facebook', 'instagram', 'google ads', 'linkedin', 'vistaprint', 'drukwerkdeal'], 'Marketing'],
  [['kpn', 'vodafone', 'odido', 't mobile', 'ziggo', 'tele2', 'simyo'], 'Telefoon & internet'],
  [['shell', 'bp', 'esso', 'tango', 'tinq', 'texaco', 'totalenergies', 'gulf', 'argos', 'tankstation'], 'Brandstof'],
  [['praxis', 'gamma', 'karwei', 'hornbach', 'bauhaus', 'hubo', 'action', 'toolstation'], 'Materiaal'],
  [['ns', 'ov chipkaart', 'arriva', 'qbuzz', 'q park', 'parkeren', 'uber', 'bolt'], 'Reiskosten'],
  [['bol com', 'coolblue', 'ikea', 'staples', 'viking', 'hema'], 'Kantoor'],
  [['ing', 'rabobank', 'abn amro', 'bunq', 'knab', 'mollie'], 'Bankkosten'],
  [['centraal beheer', 'interpolis', 'nn', 'ohra', 'allianz', 'asr'], 'Verzekeringen'],
  [['spotify', 'netflix', 'abonnement', 'lidmaatschap'], 'Abonnementen'],
  [['restaurant', 'cafe', 'lunch', 'starbucks', 'albert heijn', 'jumbo', 'bakker'], 'Representatie'],
];

export interface CategoryGuess {
  category: string;
  vatRate: VatRate;
  /** `memory`: learned from earlier choices; `keyword`: general knowledge. */
  source: 'memory' | 'keyword' | 'none';
  supplierId?: string;
}

export function findSupplier(name: string, suppliers: Supplier[]): Supplier | undefined {
  const n = normalize(name);
  if (!n) return undefined;
  return (
    suppliers.find((s) => normalize(s.name) === n) ??
    suppliers.find((s) => {
      const sn = normalize(s.name);
      return sn.length > 2 && (n.startsWith(sn) || sn.startsWith(n));
    })
  );
}

export function guessCategory(supplierName: string, suppliers: Supplier[], useMemory = true): CategoryGuess {
  const known = useMemory ? findSupplier(supplierName, suppliers) : undefined;
  if (known?.defaultCategory) {
    return { category: known.defaultCategory, vatRate: known.defaultVatRate, source: 'memory', supplierId: known.id };
  }
  const n = ` ${normalize(supplierName)} `;
  for (const [words, cat] of KEYWORDS) {
    if (words.some((w) => n.includes(` ${w} `))) return { category: cat, vatRate: cat === 'Bankkosten' || cat === 'Verzekeringen' ? 0 : 21, source: 'keyword' };
  }
  return { category: 'Overig', vatRate: 21, source: 'none' };
}
