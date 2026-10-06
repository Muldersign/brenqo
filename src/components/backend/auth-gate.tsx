'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Mail, LoaderCircle, Building, Users } from 'lucide-react';
import { toast } from 'sonner';
import { backendEnabled } from '@/lib/backend/config';
import { supabase } from '@/lib/backend/client';
import { loadAll, refresh, startSync, userFromSession } from '@/lib/backend/sync';
import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { BrandMark } from '@/components/shell/sidebar';
import { cn } from '@/lib/utils';

type Phase = 'checking' | 'signed-out' | 'loading' | 'no-org' | 'ready' | 'error';

/**
 * With Supabase configured: sign-in, load the user's administrations, keep them
 * in sync. Without it, the demo runs as before.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(backendEnabled ? 'checking' : 'ready');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!backendEnabled) return;
    const sb = supabase();
    let loadedFor: string | null = null;

    async function boot(session: Awaited<ReturnType<typeof sb.auth.getSession>>['data']['session']) {
      if (!session) {
        loadedFor = null;
        setPhase('signed-out');
        return;
      }
      if (loadedFor === session.user.id) return;
      loadedFor = session.user.id;
      setPhase('loading');
      try {
        await sb.rpc('accept_invites');
        const data = await loadAll(userFromSession(session.user), useStore.getState().activeOrgId);
        startSync(data);
        setPhase(data.organizations.length ? 'ready' : 'no-org');
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : String(e));
        setPhase('error');
      }
    }

    sb.auth.getSession().then(({ data }) => boot(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { boot(session); });

    const onVisible = () => { if (document.visibilityState === 'visible') refresh().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(() => { if (document.visibilityState === 'visible') refresh().catch(() => {}); }, 60_000);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(poll);
    };
  }, []);

  if (phase === 'ready') return <>{children}</>;
  if (phase === 'signed-out') return <SignIn />;
  if (phase === 'no-org') return <FirstOrganization onDone={() => setPhase('ready')} />;
  return (
    <Frame>
      {phase === 'error' ? (
        <div className="text-center">
          <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Je administratie kon niet worden geladen</h1>
          <p className="mt-2 text-muted">{error || 'Controleer je verbinding en probeer het opnieuw.'}</p>
          <Button className="mt-6" onClick={() => location.reload()}>Opnieuw proberen</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-muted"><LoaderCircle className="size-5 animate-spin" />Je administratie wordt geladen…</div>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-2"><BrandMark size={32} /><span className="text-[20px] font-semibold tracking-[-0.04em]">brenqo</span></div>
        {children}
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin, shouldCreateUser: true } });
    setBusy(false);
    if (error) { toast.error('Dat lukte niet', { description: error.message }); return; }
    setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) toast.error('Deze code klopt niet of is verlopen', { description: 'Vraag een nieuwe code aan.' });
  }

  return (
    <Frame>
      <div className="rounded-[24px] border border-line bg-surface p-6 shadow-card sm:p-8">
        {step === 'email' ? (
          <form onSubmit={sendCode} className="space-y-5">
            <div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Inloggen</h1>
              <p className="mt-1 text-muted">Geen wachtwoord nodig. We mailen je een inlogcode.</p>
            </div>
            <Field label="E-mailadres"><Input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jij@bedrijf.nl" /></Field>
            <Button type="submit" className="w-full" loading={busy}>Stuur inlogcode <ArrowRight /></Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-5">
            <div>
              <div className="mb-4 grid size-11 place-items-center rounded-full bg-canvas"><Mail className="size-5" /></div>
              <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Check je mail</h1>
              <p className="mt-1 text-muted">We stuurden een code naar <span className="font-medium text-ink">{email}</span>. Je kunt ook op de link in de mail tikken.</p>
            </div>
            <Field label="Inlogcode"><Input inputMode="numeric" autoComplete="one-time-code" autoFocus required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="123456" className="text-center text-[20px] tracking-[0.3em]" /></Field>
            <Button type="submit" className="w-full" loading={busy} disabled={code.length < 6}>Inloggen</Button>
            <button type="button" onClick={() => { setStep('email'); setCode(''); }} className="w-full text-center text-[13px] text-muted hover:text-ink">Ander e-mailadres</button>
          </form>
        )}
      </div>
      <p className="mt-6 text-center text-[12.5px] text-muted">Nieuw hier? Log in met je e-mailadres; je account wordt dan vanzelf aangemaakt.</p>
    </Frame>
  );
}

function FirstOrganization({ onDone }: { onDone: () => void }) {
  const createOrganization = useStore((s) => s.createOrganization);
  const user = useStore((s) => s.user);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'business' | 'association'>('business');
  return (
    <Frame>
      <form
        className="space-y-5 rounded-[24px] border border-line bg-surface p-6 shadow-card sm:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createOrganization({ name: name.trim(), kind });
          toast.success(`Welkom bij Brenqo, ${user.name}`, { description: 'Vul bij Instellingen je bedrijfsgegevens in, dan kun je direct factureren.' });
          onDone();
        }}
      >
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Je eerste administratie</h1>
          <p className="mt-1 text-muted">Later kun je er meer toevoegen, bijvoorbeeld voor een vereniging.</p>
        </div>
        <Field label="Naam"><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijvoorbeeld: Muldersign" /></Field>
        <div className="grid grid-cols-2 gap-2">
          {([['business', 'Onderneming', <Building key="b" className="size-4" />], ['association', 'Vereniging', <Users key="u" className="size-4" />]] as const).map(([v, label, icon]) => (
            <button key={v} type="button" onClick={() => setKind(v)} className={cn('flex items-center gap-2 rounded-[18px] border p-3.5 text-left text-[14px] font-medium transition', kind === v ? 'border-ink' : 'border-line hover:bg-subtle')}>
              {icon}{label}
            </button>
          ))}
        </div>
        <Button type="submit" className="w-full" disabled={!name.trim()}>Aanmaken</Button>
      </form>
    </Frame>
  );
}
