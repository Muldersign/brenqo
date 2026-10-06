'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Upload, X, FileText, Sparkles, Check, Pencil, Brain, ScanLine, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store/ui';
import { useCategories, useOrg, useStore, useSuppliers } from '@/lib/store';
import { recognizeDocument, makePreview, normalizeFile, type OcrResult } from '@/lib/services/ocr';
import { backendEnabled } from '@/lib/backend/config';
import { uploadDocument } from '@/lib/backend/sync';
import { guessCategory } from '@/lib/domain/categories';
import { formatEUR, parseAmount, round2 } from '@/lib/domain/money';
import { formatDateLong } from '@/lib/domain/dates';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { CategoryIcon } from '@/components/category-icon';
import { cn } from '@/lib/utils';
import type { VatRate } from '@/lib/types';

type Step = 'choose' | 'scanning' | 'review' | 'edit' | 'done';

interface Draft extends OcrResult {
  category: string;
  memory: 'memory' | 'keyword' | 'none';
  fileName: string;
  mimeType: string;
  preview?: string;
}

export function ScanFlow() {
  const { open, kind, capture } = useUI((s) => s.scan);
  const close = useUI((s) => s.closeScan);
  const [step, setStep] = useState<Step>('choose');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRefOriginal = useRef<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const suppliers = useSuppliers();
  const categories = useCategories();
  const org = useOrg();
  const saveExpense = useStore((s) => s.saveExpense);
  const pushNotification = useStore((s) => s.pushNotification);
  const isReceipt = kind === 'receipt';

  useEffect(() => {
    if (!open) return;
    setStep('choose');
    setDraft(null);
    setProgress(0);
    if (capture && window.matchMedia('(pointer: coarse)').matches) {
      // Phones: straight to the camera, one tap saved.
      const t = setTimeout(() => cameraRef.current?.click(), 120);
      return () => clearTimeout(t);
    }
  }, [open, capture]);

  async function handleFile(input: File | undefined) {
    if (!input) return;
    setStep('scanning');
    const file = await normalizeFile(input);
    fileRefOriginal.current = file;
    setProgress(8);
    const tick = setInterval(() => setProgress((p) => Math.min(92, p + Math.random() * 14)), 220);
    try {
      const [preview, result] = await Promise.all([makePreview(file), recognizeDocument(file, kind)]);
      const guess = guessCategory(result.supplierName, suppliers, org.automations.recognizeSuppliers);
      const known = guess.source === 'memory';
      setDraft({
        ...result,
        category: known ? guess.category : result.categoryHint || guess.category,
        vatRate: known ? guess.vatRate : result.vatRate,
        memory: guess.source,
        fileName: file.name || (isReceipt ? 'bon.jpg' : 'factuur.pdf'),
        mimeType: file.type || 'application/octet-stream',
        preview,
      });
      setProgress(100);
      setTimeout(() => setStep('review'), 250);
    } catch {
      toast.error('Dat lukte niet', { description: 'Probeer het nog eens, of vul de gegevens zelf in.' });
      setStep('choose');
    } finally {
      clearInterval(tick);
    }
  }

  async function save() {
    if (!draft) return;
    const original = fileRefOriginal.current;
    const storagePath = backendEnabled && original ? await uploadDocument(org.id, original, draft.fileName) : undefined;
    saveExpense({
      kind,
      supplierName: draft.supplierName || 'Onbekende leverancier',
      invoiceNumber: draft.invoiceNumber,
      date: draft.date,
      dueDate: draft.dueDate || undefined,
      subtotal: draft.subtotal,
      vatAmount: draft.vatAmount,
      total: draft.total,
      vatRate: draft.vatRate,
      category: draft.category,
      description: draft.description,
      iban: draft.iban,
      status: 'processed',
      paid: isReceipt,
      source: capture ? 'camera' : 'upload',
      document: { fileName: draft.fileName, mimeType: draft.mimeType, previewDataUrl: draft.preview, storagePath },
    });
    pushNotification({ kind: isReceipt ? 'receipt' : 'expense', title: `${isReceipt ? 'Bon' : 'Inkoopfactuur'} van ${draft.supplierName} is verwerkt.`, href: isReceipt ? '/bonnetjes' : '/inkoopfacturen' });
    setStep('done');
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#17171c]/40 backdrop-blur-[4px]" />
        <Dialog.Content
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[96dvh] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-pop outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[26px] data-[state=open]:animate-[fade-in_0.25s_ease-out]"
        >
          <Dialog.Title className="sr-only">{isReceipt ? 'Bon toevoegen' : 'Inkoopfactuur toevoegen'}</Dialog.Title>
          <Dialog.Description className="sr-only">Foto maken of bestand uploaden; Brenqo leest de gegevens automatisch uit.</Dialog.Description>
          <div className="flex items-center justify-between px-5 pt-4">
            {step === 'edit' ? (
              <button onClick={() => setStep('review')} className="flex items-center gap-1 text-[13.5px] font-medium text-muted hover:text-ink"><ArrowLeft className="size-4" /> Terug</button>
            ) : <span className="text-[12.5px] font-semibold uppercase tracking-wider text-faint">{isReceipt ? 'Bon toevoegen' : 'Inkoopfactuur'}</span>}
            <Dialog.Close className="grid size-9 place-items-center rounded-xl text-muted hover:bg-black/5" aria-label="Sluiten"><X className="size-[18px]" /></Dialog.Close>
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6">
            <AnimatePresence mode="wait">
              {step === 'choose' && (
                <motion.div key="choose" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <h2 className="font-display text-[22px] font-semibold">{isReceipt ? 'Bon toevoegen' : 'Inkoopfactuur toevoegen'}</h2>
                  <p className="mt-1 text-[14px] text-muted">Wij lezen leverancier, bedrag, datum en btw automatisch uit. Jij hoeft alleen te controleren.</p>
                  <div className="mt-5 grid gap-3">
                    <button onClick={() => cameraRef.current?.click()} className="group flex items-center gap-4 rounded-[24px] bg-ink p-5 text-left text-[#fafafa] transition active:scale-[0.99]">
                      <div className="grid size-12 place-items-center rounded-full bg-white/10"><Camera className="size-5" /></div>
                      <div>
                        <div className="text-[16px] font-semibold">Maak foto</div>
                        <div className="text-[13px] text-white/60">Leg de {isReceipt ? 'bon' : 'factuur'} plat neer, wij doen de rest</div>
                      </div>
                    </button>
                    <button
                      onClick={() => fileRef.current?.click()}
                      className={cn('flex items-center gap-4 rounded-[24px] border border-dashed p-5 text-left transition', dragging ? 'border-ink bg-subtle' : 'border-[#d4d4d4] hover:border-ink')}
                    >
                      <div className="grid size-12 place-items-center rounded-full bg-canvas text-ink"><Upload className="size-5" /></div>
                      <div>
                        <div className="text-[16px] font-semibold">Upload bestand</div>
                        <div className="text-[13px] text-muted">Of sleep het hierheen · JPG, PNG, HEIC of PDF</div>
                      </div>
                    </button>
                  </div>
                  {!isReceipt && (
                    <div className="mt-4 rounded-[18px] bg-canvas p-4 text-[13px] text-ink">
                      <span className="font-medium">Tip:</span> laat leveranciers facturen sturen naar <span className="font-medium underline decoration-line underline-offset-2">{org.inboxAddress}</span>. Dan staan ze hier vanzelf klaar.
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'scanning' && (
                <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8 text-center">
                  <div className="relative h-[220px] w-[170px] overflow-hidden rounded-[18px] border border-line bg-surface shadow-card">
                    <div className="space-y-2.5 p-5">
                      <div className="skeleton h-3 w-20" />
                      <div className="skeleton h-2 w-28" />
                      <div className="mt-5 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex justify-between"><div className="skeleton h-2 w-16" /><div className="skeleton h-2 w-8" /></div>)}</div>
                      <div className="mt-4 flex justify-between"><div className="skeleton h-3 w-12" /><div className="skeleton h-3 w-14" /></div>
                    </div>
                    <div className="absolute inset-x-3 h-12 animate-scan">
                      <div className="absolute inset-x-0 top-1/2 h-px bg-ink" />
                    </div>
                  </div>
                  <div className="mt-7 flex items-center gap-2 font-display text-[18px] font-semibold"><ScanLine className="size-5" />{isReceipt ? 'Bon wordt herkend…' : 'Factuur wordt gelezen…'}</div>
                  <p className="mt-1 text-[13.5px] text-muted">{progress < 40 ? 'Tekst herkennen' : progress < 75 ? 'Bedragen en btw controleren' : 'Categorie voorstellen'}</p>
                  <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full bg-ink transition-[width] duration-300" style={{ width: `${progress}%` }} /></div>
                </motion.div>
              )}

              {step === 'review' && draft && (
                <motion.div key="review" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <div className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <Sparkles className="size-4" /> {isReceipt ? 'Je bon is uitgelezen' : 'Je factuur is uitgelezen'}
                    {draft.engine === 'demo' && <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">demo</span>}
                  </div>
                  <div className="mt-3 overflow-hidden rounded-[24px] border border-line bg-surface shadow-card">
                    <div className="flex items-center gap-4 p-5">
                      <DocThumb preview={draft.preview} mime={draft.mimeType} />
                      <div className="min-w-0">
                        <div className="truncate font-display text-[20px] font-semibold">{draft.supplierName || 'Onbekend'}</div>
                        <div className="text-[13.5px] text-muted">{formatDateLong(draft.date)}</div>
                      </div>
                    </div>
                    <div className="border-t border-line px-5 py-5">
                      <div className="text-[44px] font-semibold leading-none tracking-display tabular">{formatEUR(draft.total)}</div>
                      <div className="mt-2 text-[14px] text-muted">waarvan <span className="font-medium text-ink-2 tabular">{formatEUR(draft.vatAmount)}</span> btw ({draft.vatRate}%)</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
                      <div className="flex items-center gap-2.5 text-[14px] font-medium">
                        <span className="grid size-8 place-items-center rounded-full bg-canvas text-ink"><CategoryIcon name={draft.category} /></span>
                        {draft.category}
                      </div>
                      {draft.invoiceNumber && <span className="text-[12.5px] text-muted">nr. {draft.invoiceNumber}</span>}
                    </div>
                    {draft.memory === 'memory' && (
                      <div className="flex items-start gap-2 border-t border-line bg-subtle px-5 py-3 text-[12.5px] text-ink">
                        <Brain className="mt-0.5 size-3.5 shrink-0" /> {draft.supplierName} wordt normaal geboekt als {draft.category.toLowerCase()}. We hebben dat alvast ingevuld.
                      </div>
                    )}
                  </div>
                  <h3 className="mt-6 text-center font-display text-[20px] font-semibold">Klopt dit?</h3>
                  <div className="mt-4 grid gap-2.5">
                    <Button size="lg" onClick={save} className="w-full"><Check /> Opslaan</Button>
                    <Button size="lg" variant="outline" onClick={() => setStep('edit')} className="w-full"><Pencil /> Aanpassen</Button>
                  </div>
                </motion.div>
              )}

              {step === 'edit' && draft && (
                <motion.div key="edit" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <h2 className="font-display text-[20px] font-semibold">Gegevens aanpassen</h2>
                  <Field label="Leverancier"><Input value={draft.supplierName} onChange={(e) => {
                    const g = guessCategory(e.target.value, suppliers);
                    set({ supplierName: e.target.value, ...(g.source !== 'none' ? { category: g.category } : {}) });
                  }} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Datum"><Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} /></Field>
                    <Field label="Totaal"><Input prefix="€" inputMode="decimal" defaultValue={String(draft.total).replace('.', ',')} onBlur={(e) => {
                      const total = parseAmount(e.target.value);
                      const vat = round2(total - total / (1 + draft.vatRate / 100));
                      set({ total, vatAmount: vat, subtotal: round2(total - vat) });
                    }} /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Btw-tarief">
                      <Select value={draft.vatRate} onChange={(e) => {
                        const rate = Number(e.target.value) as VatRate;
                        const vat = round2(draft.total - draft.total / (1 + rate / 100));
                        set({ vatRate: rate, vatAmount: vat, subtotal: round2(draft.total - vat) });
                      }}>
                        <option value={21}>21%</option><option value={9}>9%</option><option value={0}>0% / geen btw</option>
                      </Select>
                    </Field>
                    <Field label="Btw-bedrag"><Input prefix="€" inputMode="decimal" key={draft.vatAmount} defaultValue={String(draft.vatAmount).replace('.', ',')} onBlur={(e) => {
                      const vat = parseAmount(e.target.value);
                      set({ vatAmount: vat, subtotal: round2(draft.total - vat) });
                    }} /></Field>
                  </div>
                  <Field label="Categorie">
                    <Select value={draft.category} onChange={(e) => set({ category: e.target.value })}>
                      {categories.map((c) => <option key={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                  {!isReceipt && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Factuurnummer"><Input value={draft.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} /></Field>
                      <Field label="Vervaldatum"><Input type="date" value={draft.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
                    </div>
                  )}
                  <Field label="Omschrijving" optional><Input value={draft.description} onChange={(e) => set({ description: e.target.value })} /></Field>
                  <Button size="lg" onClick={save} className="w-full"><Check /> Opslaan</Button>
                </motion.div>
              )}

              {step === 'done' && draft && (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-10 text-center">
                  <div className="grid size-20 animate-pop place-items-center rounded-full bg-canvas">
                    <div className="grid size-14 place-items-center rounded-full bg-ink text-[#fafafa]"><Check className="size-7" strokeWidth={2.5} /></div>
                  </div>
                  <h2 className="mt-6 font-display text-[22px] font-semibold">{isReceipt ? 'Bon opgeslagen' : 'Inkoopfactuur opgeslagen'}</h2>
                  <p className="mt-1.5 max-w-xs text-[14px] text-muted">
                    {formatEUR(draft.total)} bij {draft.supplierName} staat in je kosten. Je btw-overzicht is bijgewerkt.
                  </p>
                  <div className="mt-7 grid w-full gap-2.5">
                    <Button size="lg" variant="outline" onClick={() => { setStep('choose'); setDraft(null); setTimeout(() => cameraRef.current?.click(), 50); }}><Camera /> Nog een {isReceipt ? 'bon' : 'factuur'}</Button>
                    <Button size="lg" variant="ghost" onClick={close}>Klaar</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DocThumb({ preview, mime, className }: { preview?: string; mime: string; className?: string }) {
  if (preview) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={preview} alt="" className={cn('h-16 w-12 shrink-0 rounded-[10px] object-cover ring-1 ring-line', className)} />;
  }
  const pdf = mime.includes('pdf');
  return (
    <div className={cn('relative grid h-16 w-12 shrink-0 place-items-center rounded-[10px] bg-surface ring-1 ring-line', className)}>
      <FileText className="size-5 text-ink" />
      <span className="absolute bottom-1.5 rounded-[4px] bg-canvas px-1 text-[8.5px] font-semibold uppercase text-muted">{pdf ? 'pdf' : 'img'}</span>
    </div>
  );
}
