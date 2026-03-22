import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';

type ConfirmationModalProps = {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  isLoading?: boolean;
};

export function ConfirmationModal({
  title,
  description,
  onConfirm,
  onClose,
  isLoading = false,
}: ConfirmationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!dialogRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (!isLoading) {
          onClose();
        }
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    const initialFocusable = dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    initialFocusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md"
      >
        <Card className="border-rose-700/40 bg-zinc-950/95">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-rose-500/15 p-2 text-rose-300">
              <AlertTriangle size={18} aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <h3 id={titleId} className="text-lg font-semibold text-zinc-100">
                {title}
              </h3>
              <p id={descriptionId} className="text-sm text-zinc-300">
                {description}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              disabled={isLoading}
              className="min-w-28 bg-rose-600 text-white hover:bg-rose-500"
              aria-label="Confirm delete pipeline"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={15} className="animate-spin" />
                  Deleting...
                </span>
              ) : (
                'Delete Pipeline'
              )}
            </Button>
          </div>
        </div>
        </Card>
      </div>
    </div>
  );
}
