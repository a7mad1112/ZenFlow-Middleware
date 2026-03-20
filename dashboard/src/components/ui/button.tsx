import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost';
};

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'default' && 'bg-amber-500 text-zinc-950 hover:bg-amber-400',
        variant === 'ghost' && 'bg-zinc-900 text-zinc-200 hover:bg-zinc-800',
        className,
      )}
      {...props}
    />
  );
}
