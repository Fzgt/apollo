import { NotesBrowser } from '@/components/docs/NotesBrowser';
import { allLibraryNotes, getLibraryNote, librarySections } from '@/content/library';
import { UI } from '@/content/ui';

/** 资料：按公司/项目分的学习笔记，来自 resume-review vault */
export default function LibraryPage() {
  return (
    <NotesBrowser
      sections={librarySections}
      notes={allLibraryNotes}
      getNote={getLibraryNote}
      navTitle={UI.nav.notes}
      storageKey="library"
    />
  );
}
