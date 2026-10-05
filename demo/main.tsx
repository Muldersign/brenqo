import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import '@fontsource-variable/inter';
import '@fontsource-variable/manrope';
import '../src/app/globals.css';
import { ParamsContext, matchRoute, navigate, useLocationHref } from './shims/router';
import { AppShell } from '@/components/shell/app-shell';

import Dashboard from '@/app/(app)/page';
import Invoices from '@/app/(app)/facturen/page';
import NewInvoice from '@/app/(app)/facturen/nieuw/page';
import BulkInvoices from '@/app/(app)/facturen/bulk/page';
import InvoiceDetail from '@/app/(app)/facturen/[id]/page';
import EditInvoice from '@/app/(app)/facturen/[id]/bewerken/page';
import Quotes from '@/app/(app)/offertes/page';
import NewQuote from '@/app/(app)/offertes/nieuw/page';
import QuoteDetail from '@/app/(app)/offertes/[id]/page';
import Customers from '@/app/(app)/klanten/page';
import CustomerDetail from '@/app/(app)/klanten/[id]/page';
import Products from '@/app/(app)/producten/page';
import Recurring from '@/app/(app)/periodiek/page';
import Receipts from '@/app/(app)/bonnetjes/page';
import PurchaseInvoices from '@/app/(app)/inkoopfacturen/page';
import Suppliers from '@/app/(app)/leveranciers/page';
import Bank from '@/app/(app)/bank/page';
import Accounts from '@/app/(app)/bank/rekeningen/page';
import Reports from '@/app/(app)/rapporten/page';
import Vat from '@/app/(app)/btw/page';
import Settings from '@/app/(app)/instellingen/page';
import PublicInvoice from '@/app/f/[token]/page';
import Checkout from '@/app/f/[token]/betalen/page';
import PublicQuote from '@/app/o/[token]/page';

const APP: [string, React.ComponentType][] = [
  ['/', Dashboard], ['/facturen', Invoices], ['/facturen/nieuw', NewInvoice], ['/facturen/bulk', BulkInvoices],
  ['/facturen/:id', InvoiceDetail], ['/facturen/:id/bewerken', EditInvoice], ['/offertes', Quotes], ['/offertes/nieuw', NewQuote],
  ['/offertes/:id', QuoteDetail], ['/klanten', Customers], ['/klanten/:id', CustomerDetail], ['/producten', Products],
  ['/periodiek', Recurring], ['/bonnetjes', Receipts], ['/inkoopfacturen', PurchaseInvoices], ['/leveranciers', Suppliers],
  ['/bank', Bank], ['/bank/rekeningen', Accounts], ['/rapporten', Reports], ['/btw', Vat], ['/instellingen', Settings],
];
const PUBLIC: [string, React.ComponentType][] = [['/f/:token', PublicInvoice], ['/f/:token/betalen', Checkout], ['/o/:token', PublicQuote]];

function resolve(pathname: string) {
  for (const [pattern, C] of PUBLIC) { const m = matchRoute(pattern, pathname); if (m) return { C, params: m, shell: false }; }
  for (const [pattern, C] of APP) { const m = matchRoute(pattern, pathname); if (m) return { C, params: m, shell: true }; }
  return { C: Dashboard, params: {}, shell: true };
}

function Root() {
  const href = useLocationHref();
  const { C, params, shell } = resolve(href.split('?')[0]);

  // Plain <a href="/..."> links (e.g. "Bekijk als klant") stay inside the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a');
      const h = a?.getAttribute('href');
      if (a && h && h.startsWith('/') && !e.defaultPrevented) { e.preventDefault(); navigate(h); }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const page = <ParamsContext.Provider value={params}><C key={href.split('?')[0]} /></ParamsContext.Provider>;
  return (
    <>
      {shell ? <AppShell>{page}</AppShell> : page}
      {!shell && (
        <button onClick={() => navigate('/')} className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-50 rounded-full bg-ink px-3.5 py-2 text-[12.5px] font-medium text-white shadow-pop">
          ← Terug naar Brenqo (je bekijkt nu wat de klant ziet)
        </button>
      )}
      <Toaster position="bottom-right" offset={20} mobileOffset={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
        toastOptions={{ classNames: { toast: '!rounded-2xl !border-line !shadow-pop !font-sans !text-[13.5px] !text-ink', description: '!text-muted' } }} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Root /></StrictMode>);
