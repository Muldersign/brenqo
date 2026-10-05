import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { DEFAULT_CATEGORIES } from '../domain/categories';

const ExtractedDocument = z.object({
  supplierName: z.string().describe('Naam van de winkel of leverancier, zoals op het document'),
  invoiceNumber: z.string().describe('Factuurnummer, leeg bij een kassabon'),
  date: z.string().describe('Datum van de bon of factuur, formaat YYYY-MM-DD'),
  dueDate: z.string().describe('Vervaldatum YYYY-MM-DD, leeg als niet vermeld'),
  subtotal: z.number().describe('Bedrag exclusief btw in euro'),
  vatAmount: z.number().describe('Totaal btw-bedrag in euro'),
  total: z.number().describe('Totaalbedrag inclusief btw in euro'),
  vatRate: z.union([z.literal(0), z.literal(9), z.literal(21)]).describe('Belangrijkste btw-tarief'),
  iban: z.string().describe('IBAN van de leverancier, leeg als niet vermeld'),
  description: z.string().describe('Korte omschrijving van wat er gekocht is, in het Nederlands, maximaal 8 woorden'),
  categoryHint: z.string().describe('Best passende categorie uit de lijst'),
});
export type ExtractedDocument = z.infer<typeof ExtractedDocument>;

const SYSTEM = `Je leest Nederlandse kassabonnen en inkoopfacturen uit voor een eenvoudige boekhoudapp.
Geef bedragen als getallen in euro met punt als decimaalteken. Klopt de btw niet met het tarief, neem dan de bedragen over zoals ze op het document staan.
Kies categoryHint uit: ${DEFAULT_CATEGORIES.map((c) => c.name).join(', ')}.
Laat velden die niet op het document staan leeg ("") of 0.`;

export function ocrConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Read a receipt or invoice (image or PDF) with Claude vision into structured fields. */
export async function extractDocument(bytes: Buffer, mimeType: string, kind: 'receipt' | 'invoice'): Promise<ExtractedDocument | null> {
  const client = new Anthropic();
  const data = bytes.toString('base64');
  const isPdf = mimeType === 'application/pdf';
  const imageType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType) ? mimeType : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const response = await client.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    output_config: { effort: 'low', format: zodOutputFormat(ExtractedDocument) },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          isPdf
            ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
            : { type: 'image', source: { type: 'base64', media_type: imageType, data } },
          { type: 'text', text: kind === 'receipt' ? 'Lees deze kassabon uit.' : 'Lees deze inkoopfactuur uit.' },
        ],
      },
    ],
  });

  // A refusal or truncated answer: let the user fill it in themselves.
  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') return null;
  return response.parsed_output ?? null;
}
