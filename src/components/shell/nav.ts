import {
  LayoutGrid, FileText, FilePenLine, Users, Package, Repeat, Receipt, FileInput, Truck, ArrowLeftRight, Landmark,
  ChartColumn, Percent, Settings,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: 'overdue' | 'receipts' | 'expenses' | 'bank';
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { items: [{ href: '/', label: 'Overzicht', icon: LayoutGrid }] },
  {
    label: 'Verkoop',
    items: [
      { href: '/facturen', label: 'Facturen', icon: FileText, badgeKey: 'overdue' },
      { href: '/offertes', label: 'Offertes', icon: FilePenLine },
      { href: '/periodiek', label: 'Periodiek', icon: Repeat },
      { href: '/klanten', label: 'Klanten', icon: Users },
      { href: '/producten', label: 'Producten', icon: Package },
    ],
  },
  {
    label: 'Inkoop',
    items: [
      { href: '/bonnetjes', label: 'Bonnetjes', icon: Receipt, badgeKey: 'receipts' },
      { href: '/inkoopfacturen', label: 'Inkoopfacturen', icon: FileInput, badgeKey: 'expenses' },
      { href: '/leveranciers', label: 'Leveranciers', icon: Truck },
    ],
  },
  {
    label: 'Bank',
    items: [
      { href: '/bank', label: 'Transacties', icon: ArrowLeftRight, badgeKey: 'bank' },
      { href: '/bank/rekeningen', label: 'Bankrekeningen', icon: Landmark },
    ],
  },
  {
    label: 'Inzicht',
    items: [
      { href: '/rapporten', label: 'Rapporten', icon: ChartColumn },
      { href: '/btw', label: 'Btw', icon: Percent },
    ],
  },
  { items: [{ href: '/instellingen', label: 'Instellingen', icon: Settings }] },
];

export function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/bank') return pathname === '/bank';
  return pathname === href || pathname.startsWith(`${href}/`);
}
