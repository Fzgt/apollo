import { cn } from '@/lib/utils';
import type { NoteStatus } from '@/content/notes';
import { STATUS_META } from './status';

export function StatusBadge({ status, className }: { status: NoteStatus; className?: string }) {
  const { label, className: tone, Icon } = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        tone,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
