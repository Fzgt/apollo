import { NotesBrowser } from '@/components/docs/NotesBrowser';
import { allFetchNotes, fetchSections, getFetchNote } from '@/content/fetch';
import { UI } from '@/content/ui';

/** Fetch：2026-09-10 那场面试的专用笔记，按 JD 分块 */
export default function FetchPage() {
  return (
    <NotesBrowser
      sections={fetchSections}
      notes={allFetchNotes}
      getNote={getFetchNote}
      navTitle={UI.nav.fetch}
      storageKey="fetch"
    />
  );
}
