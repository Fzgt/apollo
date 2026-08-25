import { NotesBrowser } from '@/components/docs/NotesBrowser';
import { allNotes, getNote, noteSections } from '@/content/notes';

/** 复习：两周计划按天拆开的那套笔记 */
export default function DocsPage() {
  return (
    <NotesBrowser
      sections={noteSections}
      notes={allNotes}
      getNote={getNote}
      navTitle="计划"
      storageKey="docs"
      showProgress
    />
  );
}
