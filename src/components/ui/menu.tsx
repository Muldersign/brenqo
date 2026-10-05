'use client';

import { DropdownMenu } from 'radix-ui';
import { cn } from '@/lib/utils';

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = 'end', sideOffset = 6, ...props }: DropdownMenu.DropdownMenuContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[200px] overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
          'data-[state=open]:animate-[fade-in_0.16s_ease-out]',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, icon, children, danger, hint, ...props }: DropdownMenu.DropdownMenuItemProps & { icon?: React.ReactNode; danger?: boolean; hint?: string }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] text-ink-2 outline-none transition-colors',
        'data-[highlighted]:bg-black/[0.04] data-[highlighted]:text-ink data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        '[&_svg]:size-4 [&_svg]:text-muted',
        danger && 'text-danger-600 data-[highlighted]:bg-danger-50 data-[highlighted]:text-danger-700 [&_svg]:text-danger-500',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="-mx-1.5 my-1.5 h-px bg-line" />;
}
