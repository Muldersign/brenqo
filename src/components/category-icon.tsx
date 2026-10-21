import {
  AppWindow, Server, Megaphone, Smartphone, Briefcase, TrainFront, Fuel, Hammer, Package, ShieldCheck, Landmark, Repeat,
  Coffee, CircleDashed, Tag, Building, Trophy, Flag, Users, Shirt, PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'app-window': AppWindow, server: Server, megaphone: Megaphone, smartphone: Smartphone, briefcase: Briefcase,
  'train-front': TrainFront, fuel: Fuel, hammer: Hammer, package: Package, 'shield-check': ShieldCheck, landmark: Landmark,
  repeat: Repeat, coffee: Coffee, 'circle-dashed': CircleDashed, tag: Tag, building: Building, trophy: Trophy, flag: Flag,
  users: Users, shirt: Shirt, 'party-popper': PartyPopper,
};

const BY_NAME: Record<string, string> = {
  Software: 'app-window', Hosting: 'server', Marketing: 'megaphone', 'Telefoon & internet': 'smartphone', Kantoor: 'briefcase',
  Reiskosten: 'train-front', Brandstof: 'fuel', Materiaal: 'hammer', Inkoop: 'package', Verzekeringen: 'shield-check',
  Bankkosten: 'landmark', Abonnementen: 'repeat', Representatie: 'coffee', Overig: 'circle-dashed',
  Zaalhuur: 'building', Bondskosten: 'trophy', Scheidsrechters: 'flag', 'Trainers & vrijwilligers': 'users',
  'Kleding & materiaal': 'shirt', 'Toernooien & activiteiten': 'party-popper', Kantine: 'coffee', 'Website & drukwerk': 'megaphone',
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[BY_NAME[name] ?? 'tag'] ?? Tag;
  return <Icon className={cn('size-4', className)} />;
}

export function CategoryChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-subtle px-2.5 text-[12px] font-medium text-ink-2 ring-1 ring-inset ring-line">
      <CategoryIcon name={name} className="size-3.5 text-muted" />
      {name}
    </span>
  );
}
