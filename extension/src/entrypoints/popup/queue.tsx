import { sendNewsletter } from '@/lib/api';
import {
  type ReadingListEntry,
  captureReadingListEntry,
  getImportableReadingListEntries,
  getRemoveReadingListAfterSend,
  listUnreadReadingListEntries,
  removeReadingListUrls,
} from '@/lib/reading-list';
import { scrapeActiveTab } from '@/lib/scrape';
import { supabase } from '@/lib/supabase';
import type { Resource } from '@rld/db';
import { useCallback, useEffect, useState } from 'preact/hooks';

type QueueRow = Pick<Resource, 'id' | 'url' | 'created_at'>;
type StatusKind = 'error' | 'success' | '';

export function renderQueue() {
  return <Queue />;
}

function Queue() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [importableEntries, setImportableEntries] = useState<ReadingListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'add' | 'import' | 'send' | null>(null);
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({ text: '', kind: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('resources')
      .select('id, url, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      setRows([]);
      setStatus({ text: `Failed to load: ${error.message}`, kind: 'error' });
      setLoading(false);
      return;
    }
    const nextRows = data ?? [];
    setRows(nextRows);
    try {
      const readingListEntries = await listUnreadReadingListEntries();
      setImportableEntries(
        getImportableReadingListEntries(
          readingListEntries,
          nextRows.map((row) => row.url),
        ),
      );
    } catch (err) {
      console.warn('[reading-list] load failed', err);
      setImportableEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    setBusy('add');
    setStatus({ text: 'Capturing…', kind: '' });
    try {
      const { url, content } = await scrapeActiveTab();
      const { error } = await supabase.from('resources').insert({ url, content } as never);
      if (error) throw new Error(error.message);
      setStatus({ text: 'Saved.', kind: 'success' });
      await refresh();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleImportReadingList = async () => {
    setBusy('import');
    setStatus({ text: 'Importing reading list…', kind: '' });

    let imported = 0;
    let failed = 0;

    try {
      const readingListEntries = await listUnreadReadingListEntries();
      const entries = getImportableReadingListEntries(
        readingListEntries,
        rows.map((row) => row.url),
      );
      const skipped = readingListEntries.length - entries.length;

      for (const entry of entries) {
        try {
          const content = await captureReadingListEntry(entry);
          const { error } = await supabase.from('resources').insert({
            url: entry.url,
            content,
          } as never);
          if (error) throw new Error(error.message);
          imported += 1;
        } catch (err) {
          console.warn('[reading-list] import failed', entry.url, err);
          failed += 1;
        }
      }

      setStatus({
        text: `Imported ${imported}. Skipped ${skipped}. Failed ${failed}.`,
        kind: failed > 0 ? 'error' : 'success',
      });
      await refresh();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const handleSend = async () => {
    setBusy('send');
    setStatus({ text: 'Sending newsletter… this can take up to a minute.', kind: '' });
    try {
      const result = await sendNewsletter();
      if (result.sent) {
        const removeAfterSend = await getRemoveReadingListAfterSend();
        const removal = removeAfterSend
          ? await removeReadingListUrls(new Set(result.consumedUrls))
          : null;
        const removalText = removal
          ? ` Removed ${removal.removed} from Reading List${removal.failed ? `; ${removal.failed} failed` : ''}.`
          : '';
        setStatus({
          text: `Sent! ${result.consumedCount} article(s) summarized.${removalText}`,
          kind: removal?.failed ? 'error' : 'success',
        });
      } else {
        setStatus({ text: 'No pending resources to send.', kind: 'error' });
      }
      await refresh();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div class="row">
        <button type="button" id="add" class="primary" disabled={busy !== null} onClick={handleAdd}>
          {busy === 'add' ? 'Capturing...' : 'Add current page'}
        </button>
        {importableEntries.length > 0 ? (
          <button
            type="button"
            id="import"
            disabled={busy !== null}
            onClick={handleImportReadingList}
          >
            {busy === 'import'
              ? 'Importing...'
              : `Import reading list (${importableEntries.length})`}
          </button>
        ) : null}
        <button type="button" id="send" disabled={busy !== null} onClick={handleSend}>
          {busy === 'send' ? 'Sending...' : 'Send newsletter'}
        </button>
      </div>
      <p id="status" class={`status${status.kind ? ` ${status.kind}` : ''}`}>
        {status.text}
      </p>
      <QueueList rows={rows} loading={loading} />
    </>
  );
}

function QueueList({ rows, loading }: { rows: QueueRow[]; loading: boolean }) {
  if (loading) {
    return (
      <ul id="list" class="queue-list">
        <li class="empty loading-row">Loading...</li>
      </ul>
    );
  }

  if (rows.length === 0) {
    return (
      <ul id="list" class="queue-list">
        <li class="empty">Queue is empty.</li>
      </ul>
    );
  }

  return (
    <ul id="list" class="queue-list">
      {rows.map((row) => {
        const date = new Date(row.created_at).toLocaleString();
        const shortUrl = row.url.length > 60 ? `${row.url.slice(0, 57)}…` : row.url;
        return (
          <li key={row.id}>
            <span class="url">{shortUrl}</span>
            <span class="date">{date}</span>
          </li>
        );
      })}
    </ul>
  );
}
