const ICON_CHOICES = ['🧩','🛠️','📊','📁','🗂️','🚀','🎯','📝','🔍','💡','⚙️','📦','🔧','📈','🧪','🎨','📌','🔐','🌐','⭐','🧭','📋','🖥️','📅'];

let sb;
let currentTools = [];

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('YOUR_SUPABASE') || !SHARED_LOGIN_EMAIL) {
  document.body.innerHTML =
    '<div style="max-width:520px;margin:80px auto;font:14px -apple-system,Segoe UI,sans-serif;color:#5a6470;text-align:center;line-height:1.6;">' +
    '<strong style="color:#1c2126;">Supabase is not configured yet.</strong><br>' +
    'Open <code>config.js</code> and paste in your Supabase project URL, anon key, and shared login email ' +
    '(see README.txt for step-by-step setup).</div>';
} else {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  wireLoginHandlers();
  boot();
}

async function boot() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    showMenu();
  } else {
    showLogin();
  }
}

function wireLoginHandlers() {
  document.getElementById('login-btn').onclick = doLogin;
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('logout-btn').onclick = doLogout;
  document.getElementById('add-tool-btn').onclick = () => openToolModal(null);
}

async function doLogin() {
  const pwField = document.getElementById('login-password');
  const btn = document.getElementById('login-btn');
  const err = document.getElementById('login-error');
  const password = pwField.value;
  if (!password) return;

  btn.disabled = true;
  btn.textContent = 'Logging in…';
  const { error } = await sb.auth.signInWithPassword({ email: SHARED_LOGIN_EMAIL, password });
  btn.disabled = false;
  btn.textContent = 'Log In';

  if (error) {
    err.textContent = 'Incorrect password.';
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  pwField.value = '';
  showMenu();
}

async function doLogout() {
  await sb.auth.signOut();
  showLogin();
}

function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('menu-view').style.display = 'none';
}

function showMenu() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('menu-view').style.display = '';
  loadTools();
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

/* ---------------- tools ---------------- */

async function loadTools() {
  const { data, error } = await sb.from('tools').select('*').order('sort_order');
  if (error) { toast('Could not load tools: ' + error.message); return; }
  currentTools = data || [];
  renderTools();
}

function renderTools() {
  const grid = document.getElementById('tool-grid');
  grid.innerHTML = '';

  currentTools.forEach(tool => {
    const card = document.createElement('div');
    card.className = 'tool-card';
    card.innerHTML = `
      <a class="tool-card-link" href="${escapeHtml(tool.href)}">
        <div class="tool-icon">${escapeHtml(tool.icon)}</div>
        <h3>${escapeHtml(tool.name)}</h3>
        <p>${escapeHtml(tool.description || '')}</p>
      </a>
      <div class="tool-card-actions">
        <button class="btn btn-sm tool-edit-btn">Edit</button>
        <button class="btn btn-sm btn-danger tool-del-btn">Delete</button>
      </div>
    `;
    card.querySelector('.tool-edit-btn').onclick = () => openToolModal(tool);
    card.querySelector('.tool-del-btn').onclick = () => deleteTool(tool.id);
    grid.appendChild(card);
  });
}

function openToolModal(existing) {
  const isEdit = !!existing;
  let selectedIcon = existing ? existing.icon : ICON_CHOICES[0];

  openModal(`
    <h3>${isEdit ? 'Edit Tool' : 'Add Tool'}</h3>
    <div class="field">
      <label>Name</label>
      <input type="text" id="f-name" value="${isEdit ? escapeHtml(existing.name) : ''}" placeholder="e.g. Widget Scenario Specs">
    </div>
    <div class="field">
      <label>Icon</label>
      <div class="icon-picker" id="icon-picker">
        ${ICON_CHOICES.map(ic => `<button type="button" class="icon-choice${ic === selectedIcon ? ' selected' : ''}" data-icon="${ic}">${ic}</button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label>Description</label>
      <textarea id="f-desc" placeholder="What does this tool do?">${isEdit ? escapeHtml(existing.description || '') : ''}</textarea>
    </div>
    <div class="field">
      <label>Link</label>
      <input type="text" id="f-href" value="${isEdit ? escapeHtml(existing.href) : ''}" placeholder="e.g. tools/my-tool/index.html">
      <p class="field-hint">Where this card opens — a path to that tool's own index.html, or a full URL. This only adds the menu card; building the tool itself still takes actual code.</p>
    </div>
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">${isEdit ? 'Save' : 'Add Tool'}</button>
    </div>
  `, (box) => {
    box.querySelectorAll('.icon-choice').forEach(btn => {
      btn.onclick = () => {
        box.querySelectorAll('.icon-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedIcon = btn.dataset.icon;
      };
    });

    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const name = box.querySelector('#f-name').value.trim();
      const href = box.querySelector('#f-href').value.trim();
      if (!name) { toast('Name is required'); return; }
      if (!href) { toast('Link is required'); return; }

      const payload = {
        name,
        icon: selectedIcon,
        description: box.querySelector('#f-desc').value.trim(),
        href,
      };

      let error;
      if (isEdit) {
        ({ error } = await sb.from('tools').update(payload).eq('id', existing.id));
      } else {
        payload.sort_order = currentTools.length;
        ({ error } = await sb.from('tools').insert(payload));
      }
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      await loadTools();
    };
  });
}

async function deleteTool(id) {
  if (!confirm('Remove this tool from the menu? (This does not delete any of its files.)')) return;
  const { error } = await sb.from('tools').delete().eq('id', id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  await loadTools();
}
