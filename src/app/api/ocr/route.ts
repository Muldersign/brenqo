import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { extractDocument, ocrConfigured } from '@/lib/server/ocr';
import { requireUser, serverBackendConfigured } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST multipart/form-data { file, kind } → extracted fields.
 * 501 when no ANTHROPIC_API_KEY is configured; the client then uses its demo recogniser.
 */
export async function POST(req: Request) {
  if (!ocrConfigured()) return NextResponse.json({ error: 'OCR niet geconfigureerd' }, { status: 501 });
  // With accounts switched on, only signed-in users may use the (paid) AI reader.
  if (serverBackendConfigured()) {
    const auth = await requireUser(req);
    if (auth.error) return auth.error;
  }
  const form = await req.formData();
  const file = form.get('file');
  const kind = form.get('kind') === 'invoice' ? 'invoice' : 'receipt';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Bestand is te groot (max 15 MB)' }, { status: 413 });
  if (/heic|heif/i.test(file.type)) return NextResponse.json({ error: 'HEIC wordt niet direct ondersteund' }, { status: 415 });

  try {
    const result = await extractDocument(Buffer.from(await file.arrayBuffer()), file.type, kind);
    if (!result) return NextResponse.json({ error: 'Document kon niet worden uitgelezen' }, { status: 422 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Even te druk, probeer het zo opnieuw' }, { status: 429 });
    if (error instanceof Anthropic.APIError) {
      console.error('OCR API-fout', error.status, error.message);
      return NextResponse.json({ error: 'Uitlezen mislukt' }, { status: 502 });
    }
    throw error;
  }
}
