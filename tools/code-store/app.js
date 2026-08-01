const params = new URLSearchParams(location.search);
const activeId = params.get('snippet');

let sb;
let snippets = [];        // list from Supabase (id, filename, code, ...)
let currentSnippet = null; // { id, filename, code, created_at, updated_at }

const configured = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_SUPABASE');

if (!configured) {
  document.body.innerHTML =
    '<div style="max-width:520px;margin:80px auto;font:14px -apple-system,Segoe UI,sans-serif;color:#5a6470;text-align:center;line-height:1.6;">' +
    '<strong style="color:#1c2126;">Supabase is not configured yet.</strong><br>' +
    'Open <code>config.js</code> and paste in your Supabase project URL and anon key ' +
    '(see README.txt for step-by-step setup).</div>';
} else {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  boot();
}

async function boot() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    init();
  } else {
    location.href = '../../index.html';
  }
}

async function init() {
  if (activeId) {
    showDetailView();
    await loadSnippet(activeId);
  } else {
    showListView();
    await loadSnippetList();
  }
  wireStaticButtons();
}

function showListView() {
  document.getElementById('list-view').style.display = '';
  document.getElementById('detail-view').style.display = 'none';
}

function showDetailView() {
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.style.display = 'none'; }, 2200);
}

/* ---------------- modal helper ---------------- */
function openModal(html, onMount) {
  const overlay = document.getElementById('modal-overlay');
  const box = document.getElementById('modal-box');
  box.innerHTML = html;
  overlay.style.display = 'flex';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  if (onMount) onMount(box);
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

/* ================= LIST VIEW ================= */

async function loadSnippetList() {
  const grid = document.getElementById('snippet-grid');
  const empty = document.getElementById('list-empty');
  grid.innerHTML = '';

  const { data, error } = await sb.from('snippets').select('*').order('filename');
  if (error) {
    grid.innerHTML = `<div class="empty-state">Could not load snippets: ${escapeHtml(error.message)}</div>`;
    return;
  }
  snippets = data || [];

  if (!snippets.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  snippets.forEach(s => {
    const card = document.createElement('div');
    card.className = 'snippet-card';
    card.innerHTML = `
      <h3>${escapeHtml(s.filename)}</h3>
      <div class="meta">Updated ${new Date(s.updated_at).toLocaleDateString()}</div>
    `;
    card.addEventListener('click', () => {
      location.href = '?snippet=' + encodeURIComponent(s.id);
    });
    grid.appendChild(card);
  });
}

function openNewSnippetModal() {
  openModal(`
    <h3>New Snippet</h3>
    <div class="field"><label>Filename</label><input type="text" id="f-filename" placeholder="e.g. helper.js"></div>
    <div class="field"><label>Code</label><textarea id="f-code" class="code-input" spellcheck="false" placeholder="Paste your code here"></textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Create Snippet</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const filename = box.querySelector('#f-filename').value.trim();
      const code = box.querySelector('#f-code').value;
      if (!filename) { toast('Filename is required'); return; }
      const { data, error } = await sb.from('snippets').insert({ filename, code }).select().single();
      if (error) { toast('Could not create snippet: ' + error.message); return; }
      location.href = '?snippet=' + encodeURIComponent(data.id);
    };
  });
}

/* ================= DETAIL VIEW ================= */

async function loadSnippet(id) {
  const { data, error } = await sb.from('snippets').select('*').eq('id', id).single();
  if (error || !data) {
    document.getElementById('snippet-name').textContent = 'Not found';
    document.getElementById('code-view-inner').textContent = '';
    toast('Could not load snippet: ' + (error ? error.message : 'not found'));
    return;
  }
  currentSnippet = data;
  renderSnippet();
}

function renderSnippet() {
  const s = currentSnippet;
  document.getElementById('snippet-name').textContent = s.filename;
  const codeView = document.getElementById('code-view-inner');
  codeView.textContent = s.code;
  codeView.className = '';
  hljs.highlightElement(codeView);
  exitEditMode();
}

function enterEditMode() {
  document.getElementById('code-view').style.display = 'none';
  document.getElementById('edit-view').style.display = 'block';
  document.getElementById('edit-filename').value = currentSnippet.filename;
  document.getElementById('edit-code').value = currentSnippet.code;
}

function exitEditMode() {
  document.getElementById('code-view').style.display = 'block';
  document.getElementById('edit-view').style.display = 'none';
}

async function saveEdit() {
  const newFilename = document.getElementById('edit-filename').value.trim();
  const newCode = document.getElementById('edit-code').value;
  if (!newFilename) { toast('Filename is required'); return; }

  const { error } = await sb.from('snippets').update({
    filename: newFilename,
    code: newCode,
    updated_at: new Date().toISOString(),
  }).eq('id', currentSnippet.id);
  if (error) { toast('Could not save: ' + error.message); return; }

  currentSnippet.filename = newFilename;
  currentSnippet.code = newCode;
  toast('Saved');
  renderSnippet();
}

async function deleteCurrentSnippet() {
  if (!confirm('Delete "' + currentSnippet.filename + '"? This cannot be undone.')) return;
  const { error } = await sb.from('snippets').delete().eq('id', currentSnippet.id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  location.href = location.pathname;
}

function copyCurrentSnippet() {
  if (!currentSnippet) return;
  navigator.clipboard.writeText(currentSnippet.code).then(() => toast('Copied to clipboard'));
}

/* ---------------- static button wiring ---------------- */

function wireStaticButtons() {
  const byId = (id) => document.getElementById(id);
  if (byId('new-snippet-btn')) byId('new-snippet-btn').onclick = openNewSnippetModal;
  if (byId('back-btn')) byId('back-btn').onclick = () => { location.href = location.pathname; };
  if (byId('copy-btn')) byId('copy-btn').onclick = copyCurrentSnippet;
  if (byId('edit-btn')) byId('edit-btn').onclick = enterEditMode;
  if (byId('edit-cancel')) byId('edit-cancel').onclick = exitEditMode;
  if (byId('edit-save')) byId('edit-save').onclick = saveEdit;
  if (byId('delete-btn')) byId('delete-btn').onclick = deleteCurrentSnippet;
}
