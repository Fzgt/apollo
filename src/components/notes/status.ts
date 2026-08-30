import { CheckCircle2, Circle, CircleDot, type LucideIcon } from 'lucide-react';
import type { NoteStatus } from '@/content/notes';
import { UI } from '@/content/ui';
import type { Text } from '@/lib/i18n';

export const STATUS_META: Record<
  NoteStatus,
  { label: Text; className: string; Icon: LucideIcon }
> = {
  todo: {
    label: UI.status.todo,
    className: 'border-border bg-muted/50 text-muted-foreground',
    Icon: Circle,
  },
  doing: {
    label: UI.status.doing,
    className: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    Icon: CircleDot,
  },
  done: {
    label: UI.status.done,
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    Icon: CheckCircle2,
  },
};
