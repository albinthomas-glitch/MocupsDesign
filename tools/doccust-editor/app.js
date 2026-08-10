const params = new URLSearchParams(location.search);
const activeDocId = params.get('doc');

let sb;
let documents = [];      // list from Supabase (id, title, description, ...)
let currentDoc = null;    // { id, title, description, ... }
let blocks = [];          // sections of currentDoc, in sort_order
let editsByBlock = {};    // blockId -> edits array, newest first (forever, never pruned)
const openHistory = new Set(); // block ids currently showing their history log

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
  if (activeDocId) {
    showDetailView();
    await loadDocument(activeDocId);
  } else {
    showListView();
    await loadDocList();
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

async function loadDocList() {
  const grid = document.getElementById('doc-grid');
  const empty = document.getElementById('list-empty');
  grid.innerHTML = '';

  const { data, error } = await sb.from('doccust_documents').select('*').order('updated_at', { ascending: false });
  if (error) {
    grid.innerHTML = `<div class="empty-state">Could not load documents: ${escapeHtml(error.message)}</div>`;
    return;
  }
  documents = data || [];

  if (!documents.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  documents.forEach(d => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML = `
      <h3>${escapeHtml(d.title)}</h3>
      <p>${escapeHtml(d.description || '')}</p>
      <div class="meta">Updated ${new Date(d.updated_at).toLocaleDateString()}</div>
    `;
    card.addEventListener('click', () => {
      location.href = '?doc=' + encodeURIComponent(d.id);
    });
    grid.appendChild(card);
  });
}

function openNewDocModal() {
  openModal(`
    <h3>New Document</h3>
    <div class="field"><label>Title</label><input type="text" id="f-title" placeholder="e.g. Onboarding Email Copy"></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="Optional"></textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Create Document</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const title = box.querySelector('#f-title').value.trim();
      const description = box.querySelector('#f-desc').value.trim();
      if (!title) { toast('Title is required'); return; }
      const { data, error } = await sb.from('doccust_documents').insert({ title, description }).select().single();
      if (error) { toast('Could not create document: ' + error.message); return; }
      location.href = '?doc=' + encodeURIComponent(data.id);
    };
  });
}

function openEditDocModal() {
  const d = currentDoc;
  openModal(`
    <h3>Edit Document</h3>
    <div class="field"><label>Title</label><input type="text" id="f-title" value="${escapeHtml(d.title)}"></div>
    <div class="field"><label>Description</label><textarea id="f-desc">${escapeHtml(d.description || '')}</textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const title = box.querySelector('#f-title').value.trim();
      if (!title) { toast('Title is required'); return; }
      const description = box.querySelector('#f-desc').value.trim();
      const { error } = await sb.from('doccust_documents')
        .update({ title, description, updated_at: new Date().toISOString() })
        .eq('id', d.id);
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      await loadDocument(d.id);
    };
  });
}

async function deleteCurrentDoc() {
  if (!confirm('Delete "' + currentDoc.title + '" and all its sections/history? This cannot be undone.')) return;
  const { error } = await sb.from('doccust_documents').delete().eq('id', currentDoc.id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  location.href = location.pathname;
}

/* ================= DETAIL VIEW ================= */

async function loadDocument(id) {
  const { data: doc, error: docErr } = await sb.from('doccust_documents').select('*').eq('id', id).single();
  if (docErr || !doc) {
    document.getElementById('doc-title').textContent = 'Not found';
    toast('Could not load document: ' + (docErr ? docErr.message : 'not found'));
    return;
  }
  currentDoc = doc;

  const { data: blockRows, error: blockErr } = await sb.from('doccust_blocks')
    .select('*').eq('document_id', id).order('sort_order');
  if (blockErr) { toast('Could not load sections: ' + blockErr.message); return; }
  blocks = blockRows || [];

  editsByBlock = {};
  const blockIds = blocks.map(b => b.id);
  if (blockIds.length) {
    const { data: editRows, error: editErr } = await sb.from('doccust_edits')
      .select('*').in('block_id', blockIds).order('created_at', { ascending: false });
    if (editErr) { toast('Could not load edit history: ' + editErr.message); return; }
    (editRows || []).forEach(e => {
      (editsByBlock[e.block_id] = editsByBlock[e.block_id] || []).push(e);
    });
  }

  renderDocument();
}

function renderDocument() {
  document.getElementById('doc-title').textContent = currentDoc.title;
  document.getElementById('doc-desc').textContent = currentDoc.description || '';
  renderBlocks();
}

function currentBlockText(block) {
  if (block.locked) return block.locked_text || '';
  const edits = editsByBlock[block.id] || [];
  return edits.length ? edits[0].content : '';
}

function blockPending(block) {
  if (block.locked) return false;
  const edits = editsByBlock[block.id] || [];
  return edits.length > 0 && !edits[0].remark;
}

function renderBlocks() {
  const list = document.getElementById('block-list');
  const empty = document.getElementById('block-empty');
  list.innerHTML = '';

  if (!blocks.length) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  blocks.forEach(block => list.appendChild(renderBlockCard(block)));
}

function renderBlockCard(block) {
  const edits = editsByBlock[block.id] || [];
  const pending = blockPending(block);
  const historyOpen = openHistory.has(block.id);

  const card = document.createElement('div');
  card.className = 'block-card';

  const badges = [
    block.locked
      ? '<span class="badge badge-locked">Locked</span>'
      : '<span class="badge badge-editable">Editable</span>',
    pending ? '<span class="badge badge-pending">Awaiting remark</span>' : '',
  ].join('');

  const editBtnAttrs = pending ? 'disabled title="Add a remark on the latest edit before making another edit"' : '';

  card.innerHTML = `
    <div class="block-head">
      <div class="block-head-left">
        <h3>${escapeHtml(block.name)}</h3>
        ${badges}
      </div>
      <div class="block-actions">
        <button class="btn btn-sm edit-text-btn" ${block.locked ? '' : editBtnAttrs}>Edit</button>
        <button class="btn btn-sm settings-btn">Settings</button>
        <button class="btn btn-sm btn-danger delete-block-btn">Delete</button>
      </div>
    </div>
    <div class="block-text">${escapeHtml(currentBlockText(block)) || '<em>(empty)</em>'}</div>
    ${pending ? `<div class="pending-notice">This section has an edit awaiting its impact remark. <button class="btn btn-sm add-remark-btn" data-edit-id="${edits[0].id}">Add Remark</button></div>` : ''}
    ${!block.locked && edits.length ? `<button class="btn btn-sm history-toggle">${historyOpen ? 'Hide' : 'Show'} History (${edits.length})</button>` : ''}
    <div class="history-list" style="display:${historyOpen ? '' : 'none'};"></div>
  `;

  card.querySelector('.edit-text-btn').onclick = () => {
    if (block.locked) openEditLockedTextModal(block);
    else if (!pending) openEditContentModal(block);
  };
  card.querySelector('.settings-btn').onclick = () => openEditSectionModal(block);
  card.querySelector('.delete-block-btn').onclick = () => deleteBlock(block);
  const remarkBtn = card.querySelector('.add-remark-btn');
  if (remarkBtn) remarkBtn.onclick = () => openRemarkModal(block, edits[0]);
  const histToggle = card.querySelector('.history-toggle');
  if (histToggle) {
    histToggle.onclick = () => {
      if (historyOpen) openHistory.delete(block.id); else openHistory.add(block.id);
      renderBlocks();
    };
  }

  if (historyOpen) {
    const histList = card.querySelector('.history-list');
    histList.innerHTML = edits.map((e, i) => renderHistoryItem(block, e, i, pending)).join('');
    edits.forEach((e, i) => {
      const item = histList.querySelector(`[data-history-id="${e.id}"]`);
      if (!item) return;
      const rBtn = item.querySelector('.restore-btn');
      if (rBtn) rBtn.onclick = () => restoreEdit(block, e);
      const remBtn = item.querySelector('.add-remark-btn');
      if (remBtn) remBtn.onclick = () => openRemarkModal(block, e);
    });
  }

  return card;
}

function renderHistoryItem(block, edit, index, blockPendingFlag) {
  const restorable = index === 1 && !blockPendingFlag;
  const isCurrent = index === 0;
  const when = new Date(edit.created_at).toLocaleString();
  const restoredNote = edit.restored_from_edit_id ? ' · restored from an earlier edit' : '';

  return `
    <div class="history-item${restorable ? ' restorable' : ''}" data-history-id="${edit.id}">
      <div class="h-top">
        <span class="h-meta">${isCurrent ? 'Current · ' : ''}${escapeHtml(when)}${restoredNote}</span>
        ${restorable ? `<button class="btn btn-sm restore-btn">Restore</button>` : ''}
      </div>
      <div class="h-text">${escapeHtml(edit.content) || '<em>(empty)</em>'}</div>
      ${edit.remark
        ? `<div class="h-remark"><strong>Impact:</strong> ${escapeHtml(edit.remark)}</div>`
        : `<div class="h-remark">No remark yet.${isCurrent ? ` <button class="btn btn-sm add-remark-btn">Add Remark</button>` : ''}</div>`}
    </div>
  `;
}

/* ---------------- sections (blocks) ---------------- */

function openAddSectionModal() {
  openModal(`
    <h3>Add Section</h3>
    <div class="field"><label>Name</label><input type="text" id="f-name" placeholder="e.g. Battery Spec"></div>
    <div class="field">
      <label><input type="checkbox" id="f-locked"> Locked (fixed reference text, not tracked as edits)</label>
    </div>
    <div class="field"><label>Initial text</label><textarea id="f-text" placeholder="Section content"></textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Add Section</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const name = box.querySelector('#f-name').value.trim();
      const locked = box.querySelector('#f-locked').checked;
      const text = box.querySelector('#f-text').value;
      if (!name) { toast('Name is required'); return; }

      const { data: block, error } = await sb.from('doccust_blocks').insert({
        document_id: currentDoc.id,
        name,
        locked,
        locked_text: locked ? text : '',
        sort_order: blocks.length,
      }).select().single();
      if (error) { toast('Could not add section: ' + error.message); return; }

      if (!locked) {
        const { error: editErr } = await sb.from('doccust_edits').insert({ block_id: block.id, content: text });
        if (editErr) { toast('Section created, but could not save initial text: ' + editErr.message); }
      }

      closeModal();
      await loadDocument(currentDoc.id);
    };
  });
}

function openEditSectionModal(block) {
  openModal(`
    <h3>Section Settings</h3>
    <div class="field"><label>Name</label><input type="text" id="f-name" value="${escapeHtml(block.name)}"></div>
    <div class="field">
      <label><input type="checkbox" id="f-locked" ${block.locked ? 'checked' : ''}> Locked (fixed reference text, not tracked as edits)</label>
      <p class="field-hint">Switching to Locked freezes the current text as-is. Switching to Editable starts its edit history from the current text.</p>
    </div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const name = box.querySelector('#f-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      const locked = box.querySelector('#f-locked').checked;
      const payload = { name, locked };

      if (locked && !block.locked) {
        payload.locked_text = currentBlockText(block);
      }

      const { error } = await sb.from('doccust_blocks').update(payload).eq('id', block.id);
      if (error) { toast('Could not save: ' + error.message); return; }

      if (!locked && block.locked) {
        const edits = editsByBlock[block.id] || [];
        if (!edits.length) {
          const { error: editErr } = await sb.from('doccust_edits').insert({ block_id: block.id, content: block.locked_text || '' });
          if (editErr) toast('Could not start edit history: ' + editErr.message);
        }
      }

      closeModal();
      await loadDocument(currentDoc.id);
    };
  });
}

function openEditLockedTextModal(block) {
  openModal(`
    <h3>Edit "${escapeHtml(block.name)}"</h3>
    <div class="field"><label>Text</label><textarea id="f-text" class="doc-text-input">${escapeHtml(block.locked_text || '')}</textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const text = box.querySelector('#f-text').value;
      const { error } = await sb.from('doccust_blocks').update({ locked_text: text }).eq('id', block.id);
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      await loadDocument(currentDoc.id);
    };
  });
}

async function deleteBlock(block) {
  if (!confirm('Delete section "' + block.name + '" and its entire edit history? This cannot be undone.')) return;
  const { error } = await sb.from('doccust_blocks').delete().eq('id', block.id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  await loadDocument(currentDoc.id);
}

/* ---------------- edits + remarks + restore ---------------- */

function openEditContentModal(block) {
  openModal(`
    <h3>Edit "${escapeHtml(block.name)}"</h3>
    <p class="field-hint">This saves as a new tracked edit. You'll be asked for the impact remark before you can edit this section again.</p>
    <div class="field"><label>Text</label><textarea id="f-text" class="doc-text-input">${escapeHtml(currentBlockText(block))}</textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save Edit</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const text = box.querySelector('#f-text').value;
      const { error } = await sb.from('doccust_edits').insert({ block_id: block.id, content: text });
      if (error) { toast('Could not save edit: ' + error.message); return; }
      closeModal();
      toast('Edit saved');
      await loadDocument(currentDoc.id);
    };
  });
}

function openRemarkModal(block, edit) {
  openModal(`
    <h3>Impact Remark</h3>
    <p class="field-hint">What did this edit turn out to impact? This is recorded permanently against this edit.</p>
    <div class="field"><label>Edit text</label><div class="block-text">${escapeHtml(edit.content) || '<em>(empty)</em>'}</div></div>
    <div class="field"><label>Remark</label><textarea id="f-remark" placeholder="e.g. This impacted X in T">${escapeHtml(edit.remark || '')}</textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save Remark</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const remark = box.querySelector('#f-remark').value.trim();
      if (!remark) { toast('Remark is required'); return; }
      const { error } = await sb.from('doccust_edits')
        .update({ remark, remarked_at: new Date().toISOString() })
        .eq('id', edit.id);
      if (error) { toast('Could not save remark: ' + error.message); return; }
      closeModal();
      toast('Remark saved');
      await loadDocument(currentDoc.id);
    };
  });
}

async function restoreEdit(block, edit) {
  if (!confirm('Restore this section to this earlier version? This saves as a new edit.')) return;
  const { error } = await sb.from('doccust_edits').insert({
    block_id: block.id,
    content: edit.content,
    restored_from_edit_id: edit.id,
  });
  if (error) { toast('Could not restore: ' + error.message); return; }
  toast('Restored as a new edit');
  await loadDocument(currentDoc.id);
}

/* ---------------- static button wiring ---------------- */

function wireStaticButtons() {
  const byId = (id) => document.getElementById(id);
  if (byId('new-doc-btn')) byId('new-doc-btn').onclick = openNewDocModal;
  if (byId('back-btn')) byId('back-btn').onclick = () => { location.href = location.pathname; };
  if (byId('add-section-btn')) byId('add-section-btn').onclick = openAddSectionModal;
  if (byId('edit-doc-btn')) byId('edit-doc-btn').onclick = openEditDocModal;
  if (byId('delete-doc-btn')) byId('delete-doc-btn').onclick = deleteCurrentDoc;
}
