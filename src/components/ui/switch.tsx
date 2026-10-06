'use client';

import { Switch as RSwitch } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Switch({ checked, onCheckedChange, className, disabled, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; className?: string; disabled?: boolean; id?: string }) {
  return (
    <RSwitch.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={cn(
        'relative inline-flex h-6 w-[42px] shrink-0 items-center rounded-full transition-colors duration-200',
        'bg-[#e5e5e5] data-[state=checked]:bg-ink disabled:opacity-50',
        className,
      )}
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform duration-200 data-[state=checked]:translate-x-[20px]" />
    </RSwitch.Root>
  );
}

export function SwitchRow({
  title, description, checked, onCheckedChange, icon, disabled,
}: { title: string; description?: string; checked: boolean; onCheckedChange: (v: boolean) => void; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-4 py-4', disabled && 'cursor-default opacity-60')}>
      {icon && <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-ink [&_svg]:size-[17px]">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-ink">{title}</div>
        {description && <div className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} className="mt-1" />
    </label>
  );
}
