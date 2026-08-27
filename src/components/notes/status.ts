import { CheckCircle2, Circle, CircleDot, type LucideIcon } from 'lucide-react';
import type { NoteStatus } from '@/content/notes';

export const STATUS_META: Record<
  NoteStatus,
  { label: string; className: string; Icon: LucideIcon }
> = {
  todo: {
    label: 'Not started',
    className: 'border-border bg-muted/50 text-muted-foreground',
    Icon: Circle,
  },
  doing: {
    label: 'In progress',
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Icon: CircleDot,
  },
  done: {
    label: 'Done',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
};
