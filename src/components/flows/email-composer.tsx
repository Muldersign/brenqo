'use client';

import { Paperclip, Link2, Lock } from 'lucide-react';
import { Field, Input, Textarea } from '@/components/ui/input';

export function EmailComposer({
  to, subject, body, onChange, attachment, buttonLabel, accent,
}: {
  to: string;
  subject: string;
  body: string;
  onChange: (patch: { to?: string; subject?: string; body?: string }) => void;
  attachment?: string;
  buttonLabel?: string;
  accent: string;
}) {
  return (
    <div className="space-y-4">
      <Field label="Aan"><Input type="email" value={to} onChange={(e) => onChange({ to: e.target.value })} placeholder="naam@bedrijf.nl" /></Field>
      <Field label="Onderwerp"><Input value={subject} onChange={(e) => onChange({ subject: e.target.value })} /></Field>
      <Field label="Bericht"><Textarea value={body} onChange={(e) => onChange({ body: e.target.value })} className="min-h-[200px]" /></Field>
      <div className="rounded-2xl border border-line bg-subtle p-4">
        <div className="mb-3 text-[12px] font-medium uppercase tracking-wider text-faint">Wordt automatisch toegevoegd</div>
        <div className="flex flex-wrap items-center gap-2">
          {attachment && (
            <span className="inline-flex h-8 items-center gap-2 rounded-xl bg-surface px-3 text-[13px] font-medium ring-1 ring-line">
              <Paperclip className="size-3.5 text-muted" /> {attachment}
            </span>
          )}
          {buttonLabel && (
            <span className="inline-flex h-8 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold text-white" style={{ background: accent }}>
              <Link2 className="size-3.5" /> {buttonLabel}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted"><Lock className="size-3" /> Beveiligde link</span>
        </div>
      </div>
    </div>
  );
}
