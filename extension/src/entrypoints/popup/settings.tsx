import { supabase } from '@/lib/supabase';
import { DEFAULT_RESOURCES_PER_NEWSLETTER, DEFAULT_TONE_PROMPT, type Settings } from '@rld/db';
import { useEffect, useState } from 'preact/hooks';

type SettingsForm = Pick<Settings, 'tone_prompt' | 'resources_per_newsletter'>;
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
  const [status, setStatus] = useState<{ text: string; kind: StatusKind }>({ text: '', kind: '' });
  const [saving, setSaving] = useState(false);

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

      const { data, error } = await supabase
        .from('settings')
        .select('tone_prompt, resources_per_newsletter')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setStatus({ text: `Failed to load: ${error.message}`, kind: 'error' });
        return;
      }
      if (data) {
        setForm(data);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    if (!user) return;
    const rpn = form.resources_per_newsletter;
    if (!Number.isInteger(rpn) || rpn < 1) {
      setStatus({ text: 'Resources per newsletter must be an integer ≥ 1.', kind: 'error' });
      return;
    }
    setSaving(true);
    setStatus({ text: 'Saving…', kind: '' });

    const { error: upsertError } = await supabase.from('settings').upsert({
      user_id: user.id,
      tone_prompt: form.tone_prompt,
      resources_per_newsletter: rpn,
      updated_at: new Date().toISOString(),
    });

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
      <button type="button" id="save" class="primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <p id="status" class={`status${status.kind ? ` ${status.kind}` : ''}`}>
        {status.text}
      </p>
    </>
  );
}
