import { NotesBrowser } from '@/components/docs/NotesBrowser';
import { allNotes, getNote, noteSections } from '@/content/notes';
import { UI } from '@/content/ui';

/** 复习：两周计划按天拆开的那套笔记 */
export default function DocsPage() {
  return (
    <NotesBrowser
      sections={noteSections}
      notes={allNotes}
      getNote={getNote}
      navTitle={UI.nav.plan}
      storageKey="docs"
      showProgress
    />
  );
}
