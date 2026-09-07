import { NotesBrowser } from '@/components/docs/NotesBrowser';
import { allAlgorithmNotes, algorithmSections, getAlgorithmNote } from '@/content/algorithms';
import { UI } from '@/content/ui';

/** 算法：按数据结构/解法分的 LeetCode 题解，由 scripts/sync-algorithms.mjs 从本机题解目录生成 */
export default function AlgorithmsPage() {
  return (
    <NotesBrowser
      sections={algorithmSections}
      notes={allAlgorithmNotes}
      getNote={getAlgorithmNote}
      navTitle={UI.nav.algorithms}
      bilingual={false}
      storageKey="algorithms"
    />
  );
}
