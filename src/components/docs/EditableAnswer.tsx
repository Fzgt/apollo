import { AutoTextarea } from '@/components/docs/AutoTextarea';
import { useBlock, useEditStore } from '@/lib/edit-context';
import type { AnswerData } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

interface Props {
  blockKey: string;
  seed: AnswerData;
  hint?: string;
}

/** markdown 里的 `待填` 占位，锁着时是灰字，解锁后就是输入框 */
export function EditableAnswer({ blockKey, seed, hint }: Props) {
  const { unlocked } = useEditStore();
  const [value, setValue, dirty, reset] = useBlock<AnswerData>(blockKey, seed);
  const text = value.text ?? '';

  if (!unlocked) {
    return (
      <blockquote
        className={cn(
          'my-4 whitespace-pre-wrap rounded-r-lg border-l-4 border-primary/50 bg-muted/30 py-2 pl-4',
          text ? 'text-foreground' : 'italic text-muted-foreground/70'
        )}
      >
        {text || '待填'}
        {hint ? <span className="mt-1 block text-sm text-muted-foreground/70">{hint}</span> : null}
      </blockquote>
    );
  }

  return (
    <div className="group my-4 rounded-r-lg border-l-4 border-primary/50 bg-muted/30 py-1.5 pl-2 pr-2">
      {hint ? <p className="px-2 pb-1 pt-1 text-sm text-muted-foreground/70">{hint}</p> : null}
      <AutoTextarea
        value={text}
        placeholder="待填"
        onChange={(e) => setValue({ text: e.target.value })}
      />
      {dirty && text.length > 0 ? (
        <div className="flex justify-end px-2 pb-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 opacity-0 transition hover:text-destructive group-hover:opacity-100"
          >
            <RotateCcw className="h-3 w-3" /> 清空
          </button>
        </div>
      ) : null}
    </div>
  );
}
