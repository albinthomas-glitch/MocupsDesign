const params = new URLSearchParams(location.search);
const activeId = params.get('snippet');
const viewOnly = params.get('mode') === 'view';

let sb;
let snippets = [];        // list from Supabase (id, filename, code, ...)
let currentSnippet = null; // { id, filename, code, created_at, updated_at }
let comments = [];         // review remarks pinned on the current snippet's preview
let activeTab = 'code';    // 'code' | 'preview'
let armed = false;         // true while "+ Add Remark" is waiting for the next preview click

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
  if (viewOnly) {
    init();
    return;
  }
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
  document.querySelectorAll('.owner-controls').forEach(el => {
    el.style.display = viewOnly ? 'none' : 'flex';
  });
  if (viewOnly) {
    // Share links show the interactive Preview only -- no Code tab, no
    // Copy button -- so the raw source isn't handed over just for leaving
    // a remark. (This only hides the UI affordance: the code itself is
    // still public-read in Supabase, same as it has to be for the live
    // preview to render at all -- see README's security notes.)
    activeTab = 'preview';
    const codeTabBtn = document.querySelector('.view-tab[data-mode="code"]');
    if (codeTabBtn) codeTabBtn.style.display = 'none';
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) copyBtn.style.display = 'none';
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) downloadBtn.style.display = 'none';
  }
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
  if (!viewOnly) {
    const codeView = document.getElementById('code-view-inner');
    codeView.textContent = s.code;
    codeView.className = '';
    hljs.highlightElement(codeView);
  }
  document.getElementById('edit-view').style.display = 'none';
  if (activeTab === 'preview') showPreviewTab(); else showCodeTab();
}

function enterEditMode() {
  document.getElementById('code-view').style.display = 'none';
  document.getElementById('preview-view').style.display = 'none';
  document.getElementById('edit-view').style.display = 'block';
  document.getElementById('edit-filename').value = currentSnippet.filename;
  document.getElementById('edit-code').value = currentSnippet.code;
}

function exitEditMode() {
  document.getElementById('edit-view').style.display = 'none';
  if (activeTab === 'preview') showPreviewTab(); else showCodeTab();
}

/* ---------------- code / preview tabs ---------------- */

function showCodeTab() {
  activeTab = 'code';
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'code'));
  document.getElementById('code-view').style.display = 'block';
  document.getElementById('preview-view').style.display = 'none';
  closeCommentPopover();
  setArmed(false);
}

function showPreviewTab() {
  activeTab = 'preview';
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === 'preview'));
  document.getElementById('code-view').style.display = 'none';
  document.getElementById('preview-view').style.display = 'block';
  renderPreviewFrame();
  loadComments();
}

/* ---------------- live preview + section comments ----------------
   The previewed code renders in a sandboxed iframe (allow-scripts only,
   no allow-same-origin) so it stays fully isolated from the portal --
   it can't reach this page's DOM or JS state. A small script is injected
   into the previewed HTML itself, which reports its own height back via
   postMessage (which sandboxed iframes are explicitly allowed to send
   regardless of the sandbox restrictions).

   The preview is interactive by default -- clicks reach the page's own
   elements normally (buttons, links, JS-driven UI all behave like the
   real thing), same as an actual mockup would. To leave a remark, the
   user arms it with the "+ Add Remark" button first; only then does the
   *next* click get intercepted (preventDefault/stopPropagation) and
   reported back as a selected element/box, after which it disarms
   itself automatically so the page goes back to being interactive. */

function renderPreviewFrame() {
  const frame = document.getElementById('preview-frame');
  const injected = `
<script>
(function () {
  var armed = false;
  function reportSize() {
    parent.postMessage({ source: 'code-store-preview', type: 'resize', height: document.documentElement.scrollHeight }, '*');
  }
  window.addEventListener('load', reportSize);
  window.addEventListener('resize', reportSize);
  setTimeout(reportSize, 50);
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.source !== 'code-store-parent') return;
    if (e.data.type === 'arm') armed = true;
    else if (e.data.type === 'disarm') armed = false;
  });
  document.addEventListener('click', function (e) {
    if (!armed) return;
    armed = false;
    e.preventDefault();
    e.stopPropagation();
    var el = e.target;
    var docW = document.documentElement.scrollWidth || 1;
    var docH = document.documentElement.scrollHeight || 1;
    var rect = el.getBoundingClientRect();
    var left = rect.left + window.scrollX;
    var top = rect.top + window.scrollY;
    var label = (el.tagName || 'element').toLowerCase();
    if (el.id) label += '#' + el.id;
    else if (el.className && typeof el.className === 'string' && el.className.trim()) {
      label += '.' + el.className.trim().split(/\\s+/).join('.');
    }
    parent.postMessage({
      source: 'code-store-preview',
      type: 'select',
      xPercent: (left / docW) * 100,
      yPercent: (top / docH) * 100,
      widthPercent: (rect.width / docW) * 100,
      heightPercent: (rect.height / docH) * 100,
      label: label,
    }, '*');
  }, true);
})();
<\/script>`;
  closeCommentPopover();
  setArmed(false);
  frame.srcdoc = (currentSnippet.code || '') + injected;
}

window.addEventListener('message', (e) => {
  if (!e.data || e.data.source !== 'code-store-preview') return;
  const frame = document.getElementById('preview-frame');
  if (e.source !== frame.contentWindow) return;

  if (e.data.type === 'resize') {
    frame.style.height = Math.max(e.data.height, 80) + 'px';
  } else if (e.data.type === 'select') {
    setArmed(false);
    openNewCommentPopover(e.data.xPercent, e.data.yPercent, e.data.widthPercent, e.data.heightPercent, e.data.label);
  }
});

function setArmed(next) {
  armed = next;
  const btn = document.getElementById('add-remark-btn');
  const hint = document.getElementById('armed-hint');
  const box = document.getElementById('preview-frame-box');
  if (btn) btn.textContent = armed ? 'Cancel' : '+ Add Remark';
  if (hint) hint.style.display = armed ? '' : 'none';
  if (box) box.classList.toggle('armed', armed);
}

function toggleArmRemark() {
  setArmed(!armed);
  const frame = document.getElementById('preview-frame');
  if (frame.contentWindow) {
    frame.contentWindow.postMessage({ source: 'code-store-parent', type: armed ? 'arm' : 'disarm' }, '*');
  }
}

async function loadComments() {
  const { data, error } = await sb.from('snippet_comments')
    .select('*')
    .eq('snippet_id', currentSnippet.id)
    .order('created_at');
  if (error) { toast('Could not load comments: ' + error.message); return; }
  comments = data || [];
  renderPins();
  renderCommentList();
}

function renderPins() {
  const layer = document.getElementById('pin-layer');
  layer.innerHTML = '';
  comments.forEach((c, i) => {
    const box = document.createElement('div');
    box.className = 'mark-box' + (c.resolved ? ' resolved' : '');
    box.style.left = c.x_percent + '%';
    box.style.top = c.y_percent + '%';
    box.style.width = (c.width_percent || 0) + '%';
    box.style.height = (c.height_percent || 0) + '%';
    box.title = c.comment;

    const badge = document.createElement('div');
    badge.className = 'mark-badge';
    badge.textContent = c.resolved ? '✓' : String(i + 1);
    box.appendChild(badge);

    box.onclick = (ev) => { ev.stopPropagation(); openExistingCommentPopover(c); };
    layer.appendChild(box);
  });
}

function renderCommentList() {
  const list = document.getElementById('comment-list');
  list.innerHTML = '';
  if (!comments.length) {
    list.innerHTML = '<div class="empty-state">No remarks yet. Click "+ Add Remark" to leave one.</div>';
    return;
  }
  comments.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'comment-item' + (c.resolved ? ' resolved' : '');
    item.innerHTML = `<div class="c-label">#${i + 1} ${escapeHtml(c.label || '')}</div>${escapeHtml(c.comment)}`;
    item.onclick = () => openExistingCommentPopover(c);
    list.appendChild(item);
  });
}

function closeCommentPopover() {
  const pop = document.getElementById('comment-popover');
  if (pop) pop.style.display = 'none';
}

function positionPopover(xPercent, yPercent, heightPercent) {
  const pop = document.getElementById('comment-popover');
  pop.style.left = Math.min(xPercent, 70) + '%';
  pop.style.top = Math.min(yPercent + (heightPercent || 0), 90) + '%';
  pop.style.display = 'block';
  return pop;
}

function openNewCommentPopover(xPercent, yPercent, widthPercent, heightPercent, label) {
  const pop = positionPopover(xPercent, yPercent, heightPercent);
  pop.innerHTML = `
    <div class="c-label">${escapeHtml(label)}</div>
    <textarea id="new-comment-text" placeholder="Leave a remark about this..."></textarea>
    <div class="popover-actions">
      <button class="btn btn-sm" id="new-comment-cancel">Cancel</button>
      <button class="btn btn-sm btn-primary" id="new-comment-save">Save</button>
    </div>
  `;
  pop.querySelector('#new-comment-cancel').onclick = closeCommentPopover;
  pop.querySelector('#new-comment-save').onclick = async () => {
    const text = pop.querySelector('#new-comment-text').value.trim();
    if (!text) { toast('Write a remark first'); return; }
    const { error } = await sb.from('snippet_comments').insert({
      snippet_id: currentSnippet.id,
      x_percent: xPercent,
      y_percent: yPercent,
      width_percent: widthPercent,
      height_percent: heightPercent,
      label,
      comment: text,
    });
    if (error) { toast('Could not save remark: ' + error.message); return; }
    closeCommentPopover();
    await loadComments();
  };
}

function openExistingCommentPopover(c) {
  const pop = positionPopover(c.x_percent, c.y_percent, c.height_percent);

  if (viewOnly) {
    pop.innerHTML = `
      <div class="c-label">${escapeHtml(c.label || '')}${c.resolved ? ' — done' : ''}</div>
      <div class="popover-readonly-text">${escapeHtml(c.comment)}</div>
      <div class="popover-actions" style="justify-content:flex-end;">
        <button class="btn btn-sm" id="popover-close">Close</button>
      </div>
    `;
    pop.querySelector('#popover-close').onclick = closeCommentPopover;
    return;
  }

  pop.innerHTML = `
    <div class="c-label">${escapeHtml(c.label || '')}</div>
    <textarea id="edit-comment-text">${escapeHtml(c.comment)}</textarea>
    <div class="popover-actions">
      <button class="btn btn-sm btn-danger" id="comment-delete">Delete</button>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm" id="comment-resolve">${c.resolved ? 'Reopen' : 'Mark done'}</button>
        <button class="btn btn-sm btn-primary" id="comment-save">Save</button>
      </div>
    </div>
  `;
  pop.querySelector('#comment-delete').onclick = async () => {
    if (!confirm('Delete this remark?')) return;
    const { error } = await sb.from('snippet_comments').delete().eq('id', c.id);
    if (error) { toast('Could not delete: ' + error.message); return; }
    closeCommentPopover();
    await loadComments();
  };
  pop.querySelector('#comment-resolve').onclick = async () => {
    const { error } = await sb.from('snippet_comments').update({ resolved: !c.resolved }).eq('id', c.id);
    if (error) { toast('Could not update: ' + error.message); return; }
    closeCommentPopover();
    await loadComments();
  };
  pop.querySelector('#comment-save').onclick = async () => {
    const text = pop.querySelector('#edit-comment-text').value.trim();
    if (!text) { toast('Remark cannot be empty'); return; }
    const { error } = await sb.from('snippet_comments').update({ comment: text }).eq('id', c.id);
    if (error) { toast('Could not save: ' + error.message); return; }
    closeCommentPopover();
    await loadComments();
  };
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

function shareSnippet() {
  const url = location.origin + location.pathname + '?snippet=' + encodeURIComponent(currentSnippet.id) + '&mode=view';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Share link copied to clipboard'));
  } else {
    prompt('Copy this link:', url);
  }
}

function copyCurrentSnippet() {
  if (!currentSnippet) return;
  navigator.clipboard.writeText(currentSnippet.code).then(() => toast('Copied to clipboard'));
}

function downloadCurrentSnippet() {
  if (!currentSnippet) return;
  const baseName = (currentSnippet.filename || 'snippet').replace(/\.[^./\\]+$/, '');
  const blob = new Blob([currentSnippet.code], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = baseName + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------------- static button wiring ---------------- */

function wireStaticButtons() {
  const byId = (id) => document.getElementById(id);
  if (byId('new-snippet-btn')) byId('new-snippet-btn').onclick = openNewSnippetModal;
  if (byId('back-btn')) byId('back-btn').onclick = () => { location.href = location.pathname; };
  if (byId('copy-btn')) byId('copy-btn').onclick = copyCurrentSnippet;
  if (byId('download-btn')) byId('download-btn').onclick = downloadCurrentSnippet;
  if (byId('share-btn')) byId('share-btn').onclick = shareSnippet;
  if (byId('edit-btn')) byId('edit-btn').onclick = enterEditMode;
  if (byId('edit-cancel')) byId('edit-cancel').onclick = exitEditMode;
  if (byId('edit-save')) byId('edit-save').onclick = saveEdit;
  if (byId('delete-btn')) byId('delete-btn').onclick = deleteCurrentSnippet;
  if (byId('add-remark-btn')) byId('add-remark-btn').onclick = toggleArmRemark;
  document.querySelectorAll('.view-tab').forEach(t => {
    t.onclick = () => { t.dataset.mode === 'preview' ? showPreviewTab() : showCodeTab(); };
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && armed) toggleArmRemark();
  });
}
