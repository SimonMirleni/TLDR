import { LOCAL_SETTINGS_DEFAULTS, getLocalSettings, setLocalSettings } from '@/lib/local-settings';
import {
  type ReadingListEntry,
  captureReadingListEntry,
  getImportableReadingListEntries,
  getRemoveReadingListAfterSend,
  listUnreadReadingListEntries,
  setRemoveReadingListAfterSend,
} from '@/lib/reading-list';
import { supabase } from '@/lib/supabase';
import { DEFAULT_RESOURCES_PER_NEWSLETTER, DEFAULT_TONE_PROMPT, type Settings } from '@rld/db';
import { useCallback, useEffect, useState } from 'preact/hooks';

type SettingsForm = Pick<Settings, 'tone_prompt' | 'resources_per_newsletter'>;
type LocalForm = { dwellTimeMin: number; inactiveTimeoutMin: number };
type StatusKind = 'error' | 'success' | '';

export function renderSettings() {
  return <SettingsPanel />;
}

function SettingsPanel() {
  const [user, setUser] = useState<{ id: string; email?: string } | null | undefined>(undefined);
  const [form, setForm] = useState<SettingsForm>({
    tone_prompt: DEFAULT_TONE_PROMPT,
    resources_per_newsletter: DEFAULT_RESOURCES_PER_NEWSLETTER,
  });
  const [localForm, setLocalForm] = useState<LocalForm>({
    dwellTimeMin: LOCAL_SETTINGS_DEFAULTS.dwellTimeMin,
    inactiveTimeoutMin: LOCAL_SETTINGS_DEFAULTS.inactiveTimeoutMin,
  });
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({ text: '', kind: '' });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importableEntries, setImportableEntries] = useState<ReadingListEntry[]>([]);
  const [removeReadingListAfterSend, setRemoveReadingListAfterSendState] = useState(false);

  const refreshImportableEntries = useCallback(async () => {
    try {
      const [readingListEntries, resources] = await Promise.all([
        listUnreadReadingListEntries(),
        supabase.from('resources').select('url').eq('status', 'pending'),
      ]);

      if (resources.error) throw new Error(resources.error.message);
      setImportableEntries(
        getImportableReadingListEntries(
          readingListEntries,
          (resources.data ?? []).map((row) => row.url),
        ),
      );
    } catch (err) {
      console.warn('[reading-list] load failed', err);
      setImportableEntries([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!currentUser) {
        setUser(null);
        return;
      }
      setUser({ id: currentUser.id, email: currentUser.email });

      const [remoteData, local, removeAfterSend] = await Promise.all([
        supabase
          .from('settings')
          .select('tone_prompt, resources_per_newsletter')
          .eq('user_id', currentUser.id)
          .maybeSingle(),
        getLocalSettings(),
        getRemoveReadingListAfterSend(),
      ]);

      if (cancelled) return;
      if (remoteData.error) {
        setStatus({ text: `Failed to load: ${remoteData.error.message}`, kind: 'error' });
        return;
      }
      if (remoteData.data) setForm(remoteData.data);
      setLocalForm({
        dwellTimeMin: local.dwellTimeMin,
        inactiveTimeoutMin: local.inactiveTimeoutMin,
      });
      setRemoveReadingListAfterSendState(removeAfterSend);
      void refreshImportableEntries();
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [refreshImportableEntries]);

  const handleImportReadingList = async () => {
    setImporting(true);
    setStatus({ text: 'Importing reading list…', kind: '' });

    let imported = 0;
    let failed = 0;

    try {
      const readingListEntries = await listUnreadReadingListEntries();
      const resources = await supabase.from('resources').select('url').eq('status', 'pending');
      if (resources.error) throw new Error(resources.error.message);

      const entries = getImportableReadingListEntries(
        readingListEntries,
        (resources.data ?? []).map((row) => row.url),
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
      await refreshImportableEntries();
    } catch (err) {
      setStatus({ text: err instanceof Error ? err.message : String(err), kind: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const rpn = form.resources_per_newsletter;
    if (!Number.isInteger(rpn) || rpn < 1) {
      setStatus({ text: 'Resources per newsletter must be an integer ≥ 1.', kind: 'error' });
      return;
    }
    if (!Number.isInteger(localForm.dwellTimeMin) || localForm.dwellTimeMin < 1) {
      setStatus({ text: 'Dwell time must be an integer ≥ 1.', kind: 'error' });
      return;
    }
    if (!Number.isInteger(localForm.inactiveTimeoutMin) || localForm.inactiveTimeoutMin < 1) {
      setStatus({ text: 'Inactive tab timeout must be an integer ≥ 1.', kind: 'error' });
      return;
    }
    setSaving(true);
    setStatus({ text: 'Saving…', kind: '' });

    const [{ error: upsertError }] = await Promise.all([
      supabase.from('settings').upsert({
        user_id: user.id,
        tone_prompt: form.tone_prompt,
        resources_per_newsletter: rpn,
        updated_at: new Date().toISOString(),
      }),
      setRemoveReadingListAfterSend(removeReadingListAfterSend),
      setLocalSettings({
        dwellTimeMin: localForm.dwellTimeMin,
        inactiveTimeoutMin: localForm.inactiveTimeoutMin,
      }),
    ]);

    if (upsertError) {
      setStatus({ text: upsertError.message, kind: 'error' });
    } else {
      setStatus({ text: 'Saved.', kind: 'success' });
    }
    setSaving(false);
  };

  if (user === undefined) {
    return <p class="muted">Loading…</p>;
  }

  if (!user) {
    return <p class="status error">Not signed in.</p>;
  }

  return (
    <>
      <div class="field">
        <label for="email">Email (from Google, not editable)</label>
        <input type="text" id="email" value={user.email ?? ''} disabled />
      </div>
      <div class="field">
        <label for="rpn">Resources per newsletter</label>
        <input
          type="number"
          id="rpn"
          min="1"
          step="1"
          value={form.resources_per_newsletter}
          onInput={(e) => {
            setForm((current) => ({
              ...current,
              resources_per_newsletter: Number.parseInt(e.currentTarget.value, 10),
            }));
          }}
        />
      </div>
      <div class="field">
        <label for="dwell">Dwell time before save prompt (min)</label>
        <input
          type="number"
          id="dwell"
          min="1"
          step="1"
          value={localForm.dwellTimeMin}
          onInput={(e) => {
            setLocalForm((current) => ({
              ...current,
              dwellTimeMin: Number.parseInt(e.currentTarget.value, 10),
            }));
          }}
        />
      </div>
      <div class="field">
        <label for="inactive">Inactive tab timeout (min)</label>
        <input
          type="number"
          id="inactive"
          min="1"
          step="1"
          value={localForm.inactiveTimeoutMin}
          onInput={(e) => {
            setLocalForm((current) => ({
              ...current,
              inactiveTimeoutMin: Number.parseInt(e.currentTarget.value, 10),
            }));
          }}
        />
      </div>
      <div class="field">
        <label for="tone">Tone prompt (sent to the LLM as system instructions)</label>
        <textarea
          id="tone"
          placeholder="e.g. Summarize each article in 3 bullets, technical tone."
          value={form.tone_prompt}
          onInput={(e) => {
            setForm((current) => ({ ...current, tone_prompt: e.currentTarget.value }));
          }}
        />
      </div>
      <label class="checkbox-field">
        <input
          type="checkbox"
          checked={removeReadingListAfterSend}
          onChange={(e) => {
            setRemoveReadingListAfterSendState(e.currentTarget.checked);
          }}
        />
        <span>Remove from Chrome Reading List after newsletter is sent</span>
      </label>
      <div class="row">
        {importableEntries.length > 0 ? (
          <button
            type="button"
            id="import"
            disabled={saving || importing}
            onClick={handleImportReadingList}
          >
            {importing ? 'Importing...' : `Import reading list (${importableEntries.length})`}
          </button>
        ) : null}
        <button type="button" id="save" class="primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <p id="status" class={`status${status.kind ? ` ${status.kind}` : ''}`}>
        {status.text}
      </p>
    </>
  );
}
