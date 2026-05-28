import { sendNewsletter } from '@/lib/api';
import { scrapeActiveTab } from '@/lib/scrape';
import { supabase } from '@/lib/supabase';
import type { Resource } from '@rld/db';

type QueueRow = Pick<Resource, 'id' | 'url' | 'created_at'>;

export async function renderQueue(host: HTMLElement): Promise<void> {
  host.innerHTML = `
    <div class="row">
      <button id="add" class="primary">Add current page</button>
      <button id="send">Send newsletter</button>
    </div>
    <p id="status" class="status"></p>
    <ul id="list" class="queue-list"></ul>
  `;

  const status = host.querySelector('#status') as HTMLElement;
  const list = host.querySelector('#list') as HTMLUListElement;
  const addBtn = host.querySelector('#add') as HTMLButtonElement;
  const sendBtn = host.querySelector('#send') as HTMLButtonElement;

  const setStatus = (text: string, kind: 'error' | 'success' | '' = '') => {
    status.className = kind ? `status ${kind}` : 'status';
    status.textContent = text;
  };

  const refresh = async () => {
    list.innerHTML = '<li class="empty">Loading…</li>';
    const { data, error } = await supabase
      .from('resources')
      .select('id, url, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      list.innerHTML = `<li class="empty">Failed to load: ${error.message}</li>`;
      return;
    }
    renderList(list, data ?? []);
  };

  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    setStatus('Capturing…');
    try {
      const { url, content } = await scrapeActiveTab();
      const { error } = await supabase.from('resources').insert({ url, content } as never);
      if (error) throw new Error(error.message);
      setStatus('Saved.', 'success');
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      addBtn.disabled = false;
    }
  });

  sendBtn.addEventListener('click', async () => {
    sendBtn.disabled = true;
    addBtn.disabled = true;
    setStatus('Sending newsletter… this can take up to a minute.');
    try {
      const result = await sendNewsletter();
      if (result.sent) {
        setStatus(`Sent! ${result.consumedCount} article(s) summarized.`, 'success');
      } else {
        setStatus('No pending resources to send.', 'error');
      }
      await refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      sendBtn.disabled = false;
      addBtn.disabled = false;
    }
  });

  await refresh();
}

function renderList(list: HTMLUListElement, rows: QueueRow[]): void {
  if (rows.length === 0) {
    list.innerHTML = '<li class="empty">Queue is empty.</li>';
    return;
  }
  list.innerHTML = rows
    .map((r) => {
      const date = new Date(r.created_at).toLocaleString();
      const shortUrl = r.url.length > 60 ? `${r.url.slice(0, 57)}…` : r.url;
      return `<li><span class="url">${escapeHtml(shortUrl)}</span><span class="date">${escapeHtml(date)}</span></li>`;
    })
    .join('');
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
