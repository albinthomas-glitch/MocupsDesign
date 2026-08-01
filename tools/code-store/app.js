const params = new URLSearchParams(location.search);
const activeFilename = params.get('snippet');

let sb;
let snippets = [];        // list from the GitHub folder (name, path, sha, ...)
let currentSnippet = null; // { name, path, sha, text }

const configured = SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR_SUPABASE')
  && typeof GITHUB_OWNER !== 'undefined' && GITHUB_OWNER && !GITHUB_OWNER.includes('YOUR_GITHUB');

if (!configured) {
  document.body.innerHTML =
    '<div style="max-width:520px;margin:80px auto;font:14px -apple-system,Segoe UI,sans-serif;color:#5a6470;text-align:center;line-height:1.6;">' +
    '<strong style="color:#1c2126;">Not configured yet.</strong><br>' +
    'Open <code>config.js</code> and fill in the Supabase + GITHUB_OWNER/REPO values ' +
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
  if (activeFilename) {
    showDetailView();
    await loadSnippet(activeFilename);
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

/* ---------------- GitHub Contents API (via server-side proxy) ----------------
   The GitHub token never reaches this file or the browser -- it lives only
   in the Netlify Function's environment. This just calls that function,
   passing along the current Supabase session so the function can verify
   we're actually logged in before touching GitHub. */
async function callProxy(action, payload) {
  const { data } = await sb.auth.getSession();
  const sessionToken = data.session && data.session.access_token;
  const res = await fetch('/.netlify/functions/code-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({
      action,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      path: GITHUB_SNIPPETS_PATH,
      ...payload,
    }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || res.statusText);
  return result;
}

async function ghListSnippets() {
  return callProxy('list', {});
}

async function ghGetSnippet(filename) {
  return callProxy('get', { filename });
}

async function ghSaveSnippet(filename, code, existingSha) {
  return callProxy('save', { filename, code, sha: existingSha || undefined });
}

async function ghDeleteSnippet(filename, sha) {
  await callProxy('delete', { filename, sha });
}

/* ================= LIST VIEW ================= */

async function loadSnippetList() {
  const grid = document.getElementById('snippet-grid');
  const empty = document.getElementById('list-empty');
  grid.innerHTML = '';

  try {
    snippets = await ghListSnippets();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Could not load snippets: ${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!snippets.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  snippets
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => {
      const card = document.createElement('div');
      card.className = 'snippet-card';
      card.innerHTML = `
        <h3>${escapeHtml(s.name)}</h3>
        <div class="meta">${(s.size / 1024).toFixed(1)} KB</div>
      `;
      card.addEventListener('click', () => {
        location.href = '?snippet=' + encodeURIComponent(s.name);
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
      if (filename.includes('/') || filename.includes('\\')) { toast('Filename cannot contain slashes'); return; }
      try {
        await ghSaveSnippet(filename, code, null);
        location.href = '?snippet=' + encodeURIComponent(filename);
      } catch (err) {
        toast('Could not create snippet: ' + err.message);
      }
    };
  });
}

/* ================= DETAIL VIEW ================= */

async function loadSnippet(filename) {
  const codeView = document.getElementById('code-view-inner');
  try {
    currentSnippet = await ghGetSnippet(filename);
  } catch (err) {
    document.getElementById('snippet-name').textContent = 'Not found';
    codeView.textContent = '';
    toast('Could not load snippet: ' + err.message);
    return;
  }
  renderSnippet();
}

function renderSnippet() {
  const s = currentSnippet;
  document.getElementById('snippet-name').textContent = s.name;
  const codeView = document.getElementById('code-view-inner');
  codeView.textContent = s.text;
  codeView.className = '';
  hljs.highlightElement(codeView);
  exitEditMode();
}

function enterEditMode() {
  document.getElementById('code-view').style.display = 'none';
  document.getElementById('edit-view').style.display = 'block';
  document.getElementById('edit-filename').value = currentSnippet.name;
  document.getElementById('edit-code').value = currentSnippet.text;
}

function exitEditMode() {
  document.getElementById('code-view').style.display = 'block';
  document.getElementById('edit-view').style.display = 'none';
}

async function saveEdit() {
  const newFilename = document.getElementById('edit-filename').value.trim();
  const newCode = document.getElementById('edit-code').value;
  if (!newFilename) { toast('Filename is required'); return; }
  if (newFilename.includes('/') || newFilename.includes('\\')) { toast('Filename cannot contain slashes'); return; }

  try {
    if (newFilename === currentSnippet.name) {
      await ghSaveSnippet(newFilename, newCode, currentSnippet.sha);
    } else {
      await ghSaveSnippet(newFilename, newCode, null);
      await ghDeleteSnippet(currentSnippet.name, currentSnippet.sha);
    }
    toast('Saved');
    location.href = '?snippet=' + encodeURIComponent(newFilename);
  } catch (err) {
    toast('Could not save: ' + err.message);
  }
}

async function deleteCurrentSnippet() {
  if (!confirm('Delete "' + currentSnippet.name + '"? This cannot be undone.')) return;
  try {
    await ghDeleteSnippet(currentSnippet.name, currentSnippet.sha);
    location.href = location.pathname;
  } catch (err) {
    toast('Could not delete: ' + err.message);
  }
}

function copyCurrentSnippet() {
  if (!currentSnippet) return;
  navigator.clipboard.writeText(currentSnippet.text).then(() => toast('Copied to clipboard'));
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
