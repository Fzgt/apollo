import { useState } from 'react';
import { AutoTextarea } from '@/components/docs/AutoTextarea';
import { useBlock, useEditStore } from '@/lib/edit-context';
import type { FieldRow, FieldTableData } from '@/lib/blocks';
import { cn } from '@/lib/utils';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';

interface Props {
  blockKey: string;
  seed: FieldTableData;
}

function nextRowId(rows: FieldRow[]): string {
  const max = rows.reduce((acc, row) => {
    const n = Number.parseInt(row.id.replace(/^\D+/, ''), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `r${max + 1}`;
}

function TagCell({
  row,
  editable,
  onChange,
}: {
  row: FieldRow;
  editable: boolean;
  onChange: (next: FieldRow) => void;
}) {
  const options = row.options ?? [];
  const selected = row.selected ?? [];

  const toggle = (tag: string) => {
    const next = selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag];
    onChange({ ...row, selected: next });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((tag) => {
        const on = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            disabled={!editable}
            onClick={() => toggle(tag)}
            className={cn(
              'rounded-md border px-2 py-0.5 font-mono text-xs transition-colors',
              on
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border bg-muted/50 text-muted-foreground',
              editable && !on && 'hover:border-primary/40 hover:text-foreground',
              !editable && 'cursor-default'
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

/**
 * markdown 里的「项 / 填写」表。
 * 锁着时和普通表格没区别；解锁后左右两列都能改，行能加能删。
 */
export function EditableFieldTable({ blockKey, seed }: Props) {
  const { unlocked } = useEditStore();
  const [data, setData, dirty, reset] = useBlock<FieldTableData>(blockKey, seed);
  const [confirmReset, setConfirmReset] = useState(false);

  const rows = data.rows ?? [];
  const headers = data.headers ?? ['项', '填写'];

  const patchRow = (id: string, next: FieldRow) => {
    setData({ ...data, rows: rows.map((row) => (row.id === id ? next : row)) });
  };

  const removeRow = (id: string) => {
    setData({ ...data, rows: rows.filter((row) => row.id !== id) });
  };

  const addRow = () => {
    setData({
      ...data,
      rows: [...rows, { id: nextRowId(rows), label: '', value: '', kind: 'text' }],
    });
  };

  return (
    <div className="mb-6 max-w-full">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-full border-collapse">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-1/3 border-b border-border px-3 py-3 text-left align-top font-semibold text-foreground sm:px-4">
                {headers[0]}
              </th>
              <th className="border-b border-border px-3 py-3 text-left align-top font-semibold text-foreground sm:px-4">
                {headers[1]}
              </th>
              {unlocked ? <th className="w-10 border-b border-border" aria-label="操作" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="group">
                <td className="border-b border-border px-3 py-2 align-top text-muted-foreground sm:px-4">
                  {unlocked ? (
                    <AutoTextarea
                      value={row.label}
                      placeholder="项目名"
                      className="font-medium text-muted-foreground"
                      onChange={(e) => patchRow(row.id, { ...row, label: e.target.value })}
                    />
                  ) : (
                    <span className={cn(row.kind === 'tags' && 'font-semibold text-foreground')}>
                      {row.label}
                    </span>
                  )}
                </td>
                <td className="border-b border-border px-3 py-2 align-top text-muted-foreground sm:px-4">
                  {row.kind === 'tags' ? (
                    <TagCell row={row} editable={unlocked} onChange={(next) => patchRow(row.id, next)} />
                  ) : unlocked ? (
                    <AutoTextarea
                      value={row.value}
                      placeholder="待填"
                      className="text-foreground"
                      onChange={(e) => patchRow(row.id, { ...row, value: e.target.value })}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{row.value}</span>
                  )}
                </td>
                {unlocked ? (
                  <td className="border-b border-border px-1 align-top">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`删除「${row.label || '空行'}」`}
                      className="mt-2 rounded p-1 text-muted-foreground/40 opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {unlocked ? (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> 加一行
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                if (confirmReset) {
                  reset();
                  setConfirmReset(false);
                } else {
                  setConfirmReset(true);
                }
              }}
              onBlur={() => setConfirmReset(false)}
              className={cn(
                'inline-flex items-center gap-1 text-xs transition',
                confirmReset
                  ? 'text-destructive'
                  : 'text-muted-foreground/60 hover:text-destructive'
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {confirmReset ? '再点一次，改动全丢' : '恢复原表'}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
