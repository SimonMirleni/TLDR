import { supabase } from '@/lib/supabase';
import { DEFAULT_RESOURCES_PER_NEWSLETTER, DEFAULT_TONE_PROMPT, type Settings } from '@rld/db';

export async function renderSettings(host: HTMLElement): Promise<void> {
  host.innerHTML = '<p class="muted">Loading…</p>';

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    host.innerHTML = '<p class="status error">Not signed in.</p>';
    return;
  }

  const { data, error } = await supabase
    .from('settings')
    .select('tone_prompt, resources_per_newsletter')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    host.innerHTML = `<p class="status error">Failed to load: ${error.message}</p>`;
    return;
  }

  const current: Pick<Settings, 'tone_prompt' | 'resources_per_newsletter'> = data ?? {
    tone_prompt: DEFAULT_TONE_PROMPT,
    resources_per_newsletter: DEFAULT_RESOURCES_PER_NEWSLETTER,
  };

  host.innerHTML = `
    <div class="field">
      <label>Email (from Google, not editable)</label>
      <input type="text" value="${escapeHtml(user.email ?? '')}" disabled />
    </div>
    <div class="field">
      <label for="rpn">Resources per newsletter</label>
      <input type="number" id="rpn" min="1" step="1"
             value="${current.resources_per_newsletter}" />
    </div>
    <div class="field">
      <label for="tone">Tone prompt (sent to the LLM as system instructions)</label>
      <textarea id="tone" placeholder="e.g. Summarize each article in 3 bullets, technical tone.">${escapeHtml(current.tone_prompt)}</textarea>
    </div>
    <button id="save" class="primary">Save</button>
    <p id="status" class="status"></p>
  `;

  const status = host.querySelector('#status') as HTMLElement;
  const rpnInput = host.querySelector('#rpn') as HTMLInputElement;
  const toneInput = host.querySelector('#tone') as HTMLTextAreaElement;
  const saveBtn = host.querySelector('#save') as HTMLButtonElement;

  saveBtn.addEventListener('click', async () => {
    const rpn = Number.parseInt(rpnInput.value, 10);
    if (!Number.isInteger(rpn) || rpn < 1) {
      status.className = 'status error';
      status.textContent = 'Resources per newsletter must be an integer ≥ 1.';
      return;
    }
    saveBtn.disabled = true;
    status.className = 'status';
    status.textContent = 'Saving…';

    const { error: upsertError } = await supabase.from('settings').upsert({
      user_id: user.id,
      tone_prompt: toneInput.value,
      resources_per_newsletter: rpn,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      status.className = 'status error';
      status.textContent = upsertError.message;
    } else {
      status.className = 'status success';
      status.textContent = 'Saved.';
    }
    saveBtn.disabled = false;
  });
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
