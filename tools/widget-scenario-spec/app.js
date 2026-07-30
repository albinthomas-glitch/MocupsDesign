const params = new URLSearchParams(location.search);
const projectId = params.get('project');
const viewOnly = params.get('mode') === 'view';

let currentProject = null;   // full project + categories + scenarios + media
let currentScenarioId = null;
let sb;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_SUPABASE')) {
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
  if (projectId) {
    showDetailView();
    await loadProject();
  } else {
    showListView();
    await loadProjectList();
  }
  wireStaticButtons();
}

function showListView() {
  document.getElementById('list-view').style.display = '';
  document.getElementById('detail-view').style.display = 'none';
}

function showDetailView() {
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'flex';
  document.querySelectorAll('.owner-controls').forEach(el => {
    el.style.display = viewOnly ? 'none' : 'flex';
  });
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

async function loadProjectList() {
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (error) { toast('Could not load projects: ' + error.message); return; }

  const grid = document.getElementById('project-grid');
  const empty = document.getElementById('list-empty');
  grid.innerHTML = '';

  if (!data || data.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  data.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <h3>${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.description || 'No description yet.')}</p>
      <div class="meta">${new Date(p.created_at).toLocaleDateString()}</div>
    `;
    card.addEventListener('click', () => {
      location.href = '?project=' + encodeURIComponent(p.id);
    });
    grid.appendChild(card);
  });
}

function openNewProjectModal() {
  openModal(`
    <h3>New Project</h3>
    <div class="field"><label>Title</label><input type="text" id="f-title" placeholder="e.g. Weather Reminder Widget"></div>
    <div class="field"><label>Description</label><textarea id="f-desc" placeholder="What is this widget / feature for?"></textarea></div>
    <div class="field"><label>Problem statement (optional)</label><textarea id="f-problem" placeholder="What's broken today and why this is needed."></textarea></div>
    <div class="form-row">
      <div class="field"><label>Placement page (optional)</label><input type="text" id="f-page" placeholder="e.g. Homepage"></div>
      <div class="field"><label>Placement position (optional)</label><input type="text" id="f-pos" placeholder="e.g. Top banner, below nav"></div>
    </div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Create Project</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const title = box.querySelector('#f-title').value.trim();
      if (!title) { toast('Title is required'); return; }
      const { data, error } = await sb.from('projects').insert({
        title,
        description: box.querySelector('#f-desc').value.trim(),
        problem: box.querySelector('#f-problem').value.trim(),
        placement_page: box.querySelector('#f-page').value.trim(),
        placement_position: box.querySelector('#f-pos').value.trim(),
      }).select().single();
      if (error) { toast('Could not create project: ' + error.message); return; }
      location.href = '?project=' + encodeURIComponent(data.id);
    };
  });
}

/* ================= DETAIL VIEW ================= */

async function loadProject() {
  const { data, error } = await sb
    .from('projects')
    .select('*, categories(*, scenarios(*, media(*)))')
    .eq('id', projectId)
    .single();

  if (error || !data) {
    document.getElementById('detail').innerHTML =
      '<div id="empty-state">Could not load this project. It may have been deleted, or your Supabase config in config.js is not set yet.</div>';
    return;
  }

  data.categories = (data.categories || []).sort((a, b) => a.sort_order - b.sort_order);
  data.categories.forEach(c => {
    c.scenarios = (c.scenarios || []).sort((a, b) => a.sort_order - b.sort_order);
    c.scenarios.forEach(s => {
      s.media = (s.media || []).sort((a, b) => a.sort_order - b.sort_order);
    });
  });

  currentProject = data;
  renderSidebar();

  const allScenarios = data.categories.flatMap(c => c.scenarios);
  if (currentScenarioId && allScenarios.some(s => s.id === currentScenarioId)) {
    renderScenario(currentScenarioId);
  } else if (allScenarios.length) {
    renderScenario(allScenarios[0].id);
  } else {
    document.getElementById('detail').innerHTML =
      '<div id="empty-state">No scenarios yet.' + (viewOnly ? '' : ' Add a category, then add a scenario.') + '</div>';
  }
}

function renderSidebar() {
  const p = currentProject;
  document.getElementById('widget-name').textContent = p.title;
  document.getElementById('widget-desc').textContent = p.description || '';

  const bar = document.getElementById('placement-bar');
  if (p.placement_page || p.placement_position) {
    bar.style.display = 'inline-flex';
    bar.innerHTML = '📍 <strong>' + escapeHtml(p.placement_page || '') + '</strong> — ' + escapeHtml(p.placement_position || '');
  } else {
    bar.style.display = 'none';
  }

  const catList = document.getElementById('cat-list');
  catList.innerHTML = '';

  p.categories.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'cat-block';

    const row = document.createElement('div');
    row.className = 'cat-title-row';
    row.innerHTML = `<span class="cat-title">${escapeHtml(cat.name)}</span>`;
    if (!viewOnly) {
      const del = document.createElement('button');
      del.className = 'cat-del';
      del.textContent = 'Delete';
      del.onclick = () => deleteCategory(cat.id);
      row.appendChild(del);
    }
    block.appendChild(row);

    cat.scenarios.forEach(sc => {
      const item = document.createElement('div');
      item.className = 'scenario-item';
      item.textContent = sc.name;
      item.dataset.id = sc.id;
      item.addEventListener('click', () => renderScenario(sc.id));
      block.appendChild(item);
    });

    if (!viewOnly) {
      const addBtn = document.createElement('button');
      addBtn.className = 'link-btn add-scenario-btn';
      addBtn.textContent = '+ Add Scenario';
      addBtn.onclick = () => openScenarioModal(cat.id, null);
      block.appendChild(addBtn);
    }

    catList.appendChild(block);
  });

  document.querySelectorAll('.scenario-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === currentScenarioId);
  });
}

function renderScenario(id) {
  currentScenarioId = id;
  document.querySelectorAll('.scenario-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  const sc = currentProject.categories.flatMap(c => c.scenarios).find(s => s.id === id);
  if (!sc) return;

  const detail = document.getElementById('detail');
  detail.innerHTML = `
    <div class="detail-title-row">
      <h2>${escapeHtml(sc.name)}</h2>
      <div class="detail-actions owner-controls" style="display:${viewOnly ? 'none' : 'flex'}">
        <button class="btn btn-sm" id="edit-sc-btn">Edit</button>
        <button class="btn btn-sm btn-danger" id="del-sc-btn">Delete</button>
      </div>
    </div>
    <div class="trigger"><strong>Trigger:</strong> ${escapeHtml(sc.trigger_text || '')}</div>

    <div class="block">
      <div class="block-label">Mockups / Screenshots / Video</div>
      <div class="media-grid" id="media-grid-mockup"></div>
      ${renderCodeBlock('mockup', sc.mockup_code)}
    </div>

    <div class="block">
      <div class="block-label">Message Sent</div>
      <div class="block-body">${escapeHtml(sc.message || '—')}</div>
      <div class="media-grid" id="media-grid-message"></div>
      ${renderCodeBlock('message', sc.message_code)}
    </div>

    <div class="block">
      <div class="block-label">Popup Shown</div>
      <div class="block-body">${escapeHtml(sc.popup || '—')}</div>
      <div class="media-grid" id="media-grid-popup"></div>
      ${renderCodeBlock('popup', sc.popup_code)}
    </div>

    <div class="block backend">
      <div class="block-label">Backend</div>
      <div class="block-body">${escapeHtml(sc.backend || '—')}</div>
    </div>
  `;

  renderMediaSection(sc, 'mockup', 'media-grid-mockup');
  renderMediaSection(sc, 'message', 'media-grid-message');
  renderMediaSection(sc, 'popup', 'media-grid-popup');
  wireCodeBlock('mockup');
  wireCodeBlock('message');
  wireCodeBlock('popup');

  if (!viewOnly) {
    detail.querySelector('#edit-sc-btn').onclick = () => openScenarioModal(sc.category_id, sc);
    detail.querySelector('#del-sc-btn').onclick = () => deleteScenario(sc.id);
  }
}

function renderMediaSection(sc, section, gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';

  sc.media.filter(m => m.section === section).forEach(m => {
    const { data } = sb.storage.from('media').getPublicUrl(m.storage_path);
    const url = data.publicUrl;
    const item = document.createElement('div');
    item.className = 'media-item';
    item.innerHTML = m.media_type === 'video'
      ? `<video src="${url}" controls></video>`
      : `<img src="${url}" alt="${escapeHtml(m.caption || '')}" onerror="this.parentElement.innerHTML='<div class=\\'mockup-missing\\'>File missing in storage</div>'">`;
    if (!viewOnly) {
      const del = document.createElement('button');
      del.className = 'media-del';
      del.textContent = '×';
      del.title = 'Remove';
      del.onclick = () => deleteMedia(m.id, m.storage_path);
      item.appendChild(del);
    }
    grid.appendChild(item);
  });

  if (!viewOnly) {
    const add = document.createElement('label');
    add.className = 'media-add';
    add.innerHTML = '+ Add screenshot or video<input type="file" accept="image/*,video/*">';
    add.querySelector('input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) uploadMedia(sc.id, file, section);
    });
    grid.appendChild(add);
  }
}

/* ---------------- code blocks (code + sandboxed live preview) ---------------- */

function renderCodeBlock(section, code) {
  if (!code) return '';
  return `
    <div class="code-block" data-section="${section}">
      <div class="code-tabs">
        <button type="button" class="code-tab active" data-mode="code">Code</button>
        <button type="button" class="code-tab" data-mode="preview">Preview</button>
      </div>
      <pre class="code-view"><code>${escapeHtml(code)}</code></pre>
      <iframe class="code-preview-frame" style="display:none;" sandbox="allow-scripts"></iframe>
    </div>
  `;
}

function wireCodeBlock(section) {
  const block = document.querySelector(`.code-block[data-section="${section}"]`);
  if (!block) return;

  const codeView = block.querySelector('.code-view');
  const frame = block.querySelector('.code-preview-frame');
  const rawCode = codeView.textContent;

  block.querySelectorAll('.code-tab').forEach(tab => {
    tab.onclick = () => {
      block.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.mode === 'preview') {
        codeView.style.display = 'none';
        frame.style.display = 'block';
        frame.srcdoc = rawCode;
      } else {
        codeView.style.display = 'block';
        frame.style.display = 'none';
      }
    };
  });
}

/* ---------------- project CRUD ---------------- */

function openEditProjectModal() {
  const p = currentProject;
  openModal(`
    <h3>Edit Project</h3>
    <div class="field"><label>Title</label><input type="text" id="f-title" value="${escapeHtml(p.title)}"></div>
    <div class="field"><label>Description</label><textarea id="f-desc">${escapeHtml(p.description || '')}</textarea></div>
    <div class="field"><label>Problem statement</label><textarea id="f-problem">${escapeHtml(p.problem || '')}</textarea></div>
    <div class="form-row">
      <div class="field"><label>Placement page</label><input type="text" id="f-page" value="${escapeHtml(p.placement_page || '')}"></div>
      <div class="field"><label>Placement position</label><input type="text" id="f-pos" value="${escapeHtml(p.placement_position || '')}"></div>
    </div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const title = box.querySelector('#f-title').value.trim();
      if (!title) { toast('Title is required'); return; }
      const { error } = await sb.from('projects').update({
        title,
        description: box.querySelector('#f-desc').value.trim(),
        problem: box.querySelector('#f-problem').value.trim(),
        placement_page: box.querySelector('#f-page').value.trim(),
        placement_position: box.querySelector('#f-pos').value.trim(),
      }).eq('id', p.id);
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      await loadProject();
      toast('Project updated');
    };
  });
}

async function deleteProject() {
  if (!confirm('Delete "' + currentProject.title + '" and everything in it? This cannot be undone.')) return;
  const { error } = await sb.from('projects').delete().eq('id', currentProject.id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  location.href = location.pathname;
}

function shareProject() {
  const url = location.origin + location.pathname + '?project=' + encodeURIComponent(currentProject.id) + '&mode=view';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Share link copied to clipboard'));
  } else {
    prompt('Copy this link:', url);
  }
}

/* ---------------- PDF export ---------------- */

function buildPrintHtml() {
  const p = currentProject;
  let html = '<div class="print-project">';
  html += `<h1>${escapeHtml(p.title)}</h1>`;
  if (p.description) html += `<p class="print-desc">${escapeHtml(p.description)}</p>`;
  if (p.problem) html += `<div class="print-block"><h4>Problem</h4><p>${escapeHtml(p.problem)}</p></div>`;
  if (p.placement_page || p.placement_position) {
    html += `<div class="print-block"><h4>Placement</h4><p>${escapeHtml(p.placement_page || '')} — ${escapeHtml(p.placement_position || '')}</p></div>`;
  }

  const printSection = (label, text, code, media) => {
    let out = label ? `<p><strong>${label}:</strong> ${escapeHtml(text || '—')}</p>` : '';
    const images = media.filter(m => m.media_type === 'image');
    const videos = media.filter(m => m.media_type === 'video');
    if (images.length) {
      out += '<div class="print-media">';
      images.forEach(m => {
        const { data } = sb.storage.from('media').getPublicUrl(m.storage_path);
        out += `<img src="${data.publicUrl}">`;
      });
      out += '</div>';
    }
    if (videos.length) {
      out += `<p class="print-video-note">🎥 ${videos.length} video(s) attached — not shown in the PDF, view them in the app.</p>`;
    }
    if (code) {
      out += `<pre class="print-code"><code>${escapeHtml(code)}</code></pre>`;
    }
    return out;
  };

  p.categories.forEach(cat => {
    html += `<h2 class="print-cat">${escapeHtml(cat.name)}</h2>`;
    cat.scenarios.forEach(sc => {
      html += '<div class="print-scenario">';
      html += `<h3>${escapeHtml(sc.name)}</h3>`;
      if (sc.trigger_text) html += `<p><strong>Trigger:</strong> ${escapeHtml(sc.trigger_text)}</p>`;

      const mockupMedia = sc.media.filter(m => m.section === 'mockup');
      if (mockupMedia.length || sc.mockup_code) {
        html += '<p><strong>Mockups</strong></p>';
        html += printSection('', '', sc.mockup_code, mockupMedia);
      }
      html += printSection('Message Sent', sc.message, sc.message_code, sc.media.filter(m => m.section === 'message'));
      html += printSection('Popup Shown', sc.popup, sc.popup_code, sc.media.filter(m => m.section === 'popup'));
      html += `<p><strong>Backend:</strong> ${escapeHtml(sc.backend || '—')}</p>`;
      html += '</div>';
    });
  });

  html += '</div>';
  return html;
}

async function exportPdf() {
  if (!currentProject) return;
  const area = document.getElementById('print-area');
  area.innerHTML = buildPrintHtml();
  document.body.classList.add('printing');

  const imgs = Array.from(area.querySelectorAll('img'));
  await Promise.all(imgs.map(img => img.complete
    ? Promise.resolve()
    : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));

  window.print();
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
});

/* ---------------- category CRUD ---------------- */

function openNewCategoryModal() {
  openModal(`
    <h3>New Category</h3>
    <div class="field"><label>Category name</label><input type="text" id="f-name" placeholder="e.g. Time Selection"></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Add Category</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const name = box.querySelector('#f-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      const { error } = await sb.from('categories').insert({
        project_id: currentProject.id,
        name,
        sort_order: currentProject.categories.length,
      });
      if (error) { toast('Could not add category: ' + error.message); return; }
      closeModal();
      await loadProject();
    };
  });
}

async function deleteCategory(id) {
  if (!confirm('Delete this category and all its scenarios?')) return;
  const { error } = await sb.from('categories').delete().eq('id', id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  if (currentProject.categories.find(c => c.id === id)?.scenarios.some(s => s.id === currentScenarioId)) {
    currentScenarioId = null;
  }
  await loadProject();
}

/* ---------------- scenario CRUD ---------------- */

function openScenarioModal(categoryId, existing) {
  const isEdit = !!existing;
  openModal(`
    <h3>${isEdit ? 'Edit Scenario' : 'New Scenario'}</h3>
    <div class="field"><label>Scenario name</label><input type="text" id="f-name" value="${isEdit ? escapeHtml(existing.name) : ''}" placeholder="e.g. Default Time Selected"></div>
    <div class="field"><label>Trigger</label><textarea id="f-trigger" placeholder="When does this happen?">${isEdit ? escapeHtml(existing.trigger_text || '') : ''}</textarea></div>
    <div class="field"><label>Mockup code (optional)</label><textarea id="f-mockup-code" class="code-input" placeholder="HTML/CSS/JS for the mockup, if useful alongside the screenshots">${isEdit ? escapeHtml(existing.mockup_code || '') : ''}</textarea></div>
    <div class="field"><label>Message sent</label><textarea id="f-message" placeholder="Exact message text, or 'None sent.'">${isEdit ? escapeHtml(existing.message || '') : ''}</textarea></div>
    <div class="field"><label>Message code (optional)</label><textarea id="f-message-code" class="code-input" placeholder="HTML/template code for this message">${isEdit ? escapeHtml(existing.message_code || '') : ''}</textarea></div>
    <div class="field"><label>Popup shown</label><textarea id="f-popup" placeholder="Exact popup copy, or 'None.'">${isEdit ? escapeHtml(existing.popup || '') : ''}</textarea></div>
    <div class="field"><label>Popup code (optional)</label><textarea id="f-popup-code" class="code-input" placeholder="HTML/CSS/JS for this popup">${isEdit ? escapeHtml(existing.popup_code || '') : ''}</textarea></div>
    <div class="field"><label>Backend behavior</label><textarea id="f-backend" placeholder="What happens on the backend">${isEdit ? escapeHtml(existing.backend || '') : ''}</textarea></div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">${isEdit ? 'Save' : 'Add Scenario'}</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const name = box.querySelector('#f-name').value.trim();
      if (!name) { toast('Name is required'); return; }
      const payload = {
        name,
        trigger_text: box.querySelector('#f-trigger').value.trim(),
        mockup_code: box.querySelector('#f-mockup-code').value.trim(),
        message: box.querySelector('#f-message').value.trim(),
        message_code: box.querySelector('#f-message-code').value.trim(),
        popup: box.querySelector('#f-popup').value.trim(),
        popup_code: box.querySelector('#f-popup-code').value.trim(),
        backend: box.querySelector('#f-backend').value.trim(),
      };
      let error;
      if (isEdit) {
        ({ error } = await sb.from('scenarios').update(payload).eq('id', existing.id));
      } else {
        const cat = currentProject.categories.find(c => c.id === categoryId);
        payload.category_id = categoryId;
        payload.sort_order = cat ? cat.scenarios.length : 0;
        let inserted;
        ({ data: inserted, error } = await sb.from('scenarios').insert(payload).select().single());
        if (!error) currentScenarioId = inserted.id;
      }
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      await loadProject();
    };
  });
}

async function deleteScenario(id) {
  if (!confirm('Delete this scenario?')) return;
  const { error } = await sb.from('scenarios').delete().eq('id', id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  currentScenarioId = null;
  await loadProject();
}

/* ---------------- media ---------------- */

async function uploadMedia(scenarioId, file, section) {
  const isVideo = file.type.startsWith('video/');
  const path = `${scenarioId}/${crypto.randomUUID()}-${file.name}`;

  toast('Uploading…');
  const { error: upErr } = await sb.storage.from('media').upload(path, file);
  if (upErr) { toast('Upload failed: ' + upErr.message); return; }

  const sc = currentProject.categories.flatMap(c => c.scenarios).find(s => s.id === scenarioId);
  const { error } = await sb.from('media').insert({
    scenario_id: scenarioId,
    storage_path: path,
    media_type: isVideo ? 'video' : 'image',
    section,
    sort_order: sc ? sc.media.filter(m => m.section === section).length : 0,
  });
  if (error) { toast('Could not save media: ' + error.message); return; }

  toast('Uploaded');
  await loadProject();
}

async function deleteMedia(id, storagePath) {
  if (!confirm('Remove this file?')) return;
  await sb.storage.from('media').remove([storagePath]);
  const { error } = await sb.from('media').delete().eq('id', id);
  if (error) { toast('Could not remove: ' + error.message); return; }
  await loadProject();
}

/* ---------------- static button wiring ---------------- */

function wireStaticButtons() {
  const byId = (id) => document.getElementById(id);
  if (byId('new-project-btn')) byId('new-project-btn').onclick = openNewProjectModal;
  if (byId('back-btn')) byId('back-btn').onclick = () => { location.href = location.pathname; };
  if (byId('share-btn')) byId('share-btn').onclick = shareProject;
  if (byId('pdf-btn')) byId('pdf-btn').onclick = exportPdf;
  if (byId('edit-project-btn')) byId('edit-project-btn').onclick = openEditProjectModal;
  if (byId('delete-project-btn')) byId('delete-project-btn').onclick = deleteProject;
  if (byId('add-category-btn')) byId('add-category-btn').onclick = openNewCategoryModal;
}
