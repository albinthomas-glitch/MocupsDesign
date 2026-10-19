const params = new URLSearchParams(location.search);
const activeId = params.get('post');
const viewOnly = params.get('mode') === 'view';

const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'X (Twitter)', 'YouTube', 'TikTok', 'Other'];
const STATUSES = { draft: 'Draft', scheduled: 'Scheduled', posted: 'Posted' };

let sb;
let posts = [];          // list view: posts with their smm_metrics rows nested
let currentPost = null;  // detail view: { ...post, smm_metrics: [...] }

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
    document.body.classList.add('view-only');
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
  wireStaticButtons();
  if (activeId) {
    showDetailView();
    await loadPost(activeId);
  } else {
    showListView();
    await loadPostList();
  }
}

function showListView() {
  document.getElementById('list-view').style.display = '';
  document.getElementById('detail-view').style.display = 'none';
}

function showDetailView() {
  document.getElementById('list-view').style.display = 'none';
  document.getElementById('detail-view').style.display = 'block';
}

/* ---------------- helpers ---------------- */

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

function mediaUrl(path) {
  return path ? sb.storage.from('media').getPublicUrl(path).data.publicUrl : '';
}

function fmtNum(n) { return (n || 0).toLocaleString(); }
function fmtDateTime(iso) {
  return iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}
function fmtDate(d) {
  // recorded_on is a plain date ("2026-10-19"); parse as local, not UTC.
  return d ? new Date(d + 'T00:00:00').toLocaleDateString([], { dateStyle: 'medium' }) : '—';
}
function ctr(m) {
  return m && m.impressions ? (m.clicks / m.impressions) * 100 : null;
}
function fmtCtr(m) {
  const v = ctr(m);
  return v == null ? '—' : v.toFixed(2) + '%';
}

// <input type="datetime-local"> works in local time without a zone suffix.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null;
}
function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Metrics are a log of snapshots; the newest one is the post's current figures.
function sortedMetrics(post) {
  return (post.smm_metrics || []).slice().sort((a, b) =>
    b.recorded_on.localeCompare(a.recorded_on) || b.created_at.localeCompare(a.created_at));
}
function latestMetrics(post) {
  return sortedMetrics(post)[0] || null;
}

function contentHtml(text) {
  return escapeHtml(text).replace(/(^|\s)(#[\w]+)/g, '$1<span class="tag">$2</span>');
}

/* ================= LIST VIEW ================= */

async function loadPostList() {
  const { data, error } = await sb.from('smm_posts')
    .select('*, smm_metrics(*)')
    .order('created_at', { ascending: false });
  if (error) {
    document.getElementById('post-rows').innerHTML =
      `<tr><td colspan="8" class="empty-state">Could not load posts: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }
  posts = data || [];

  const platformSel = document.getElementById('filter-platform');
  const used = [...new Set(posts.map(p => p.platform))].sort();
  platformSel.innerHTML = '<option value="">All platforms</option>' +
    used.map(p => `<option>${escapeHtml(p)}</option>`).join('');

  renderPostList();
}

function filteredPosts() {
  const platform = document.getElementById('filter-platform').value;
  const status = document.getElementById('filter-status').value;
  return posts.filter(p => (!platform || p.platform === platform) && (!status || p.status === status));
}

function renderPostList() {
  const rows = document.getElementById('post-rows');
  const empty = document.getElementById('list-empty');
  const tableWrap = document.getElementById('post-table-wrap');
  const list = filteredPosts();
  rows.innerHTML = '';

  renderSummary(list);

  if (!posts.length) {
    empty.style.display = 'block';
    tableWrap.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  tableWrap.style.display = '';

  if (!list.length) {
    rows.innerHTML = '<tr><td colspan="8" class="muted-cell">No posts match these filters.</td></tr>';
    return;
  }

  list.forEach(p => {
    const m = latestMetrics(p);
    const tr = document.createElement('tr');
    const thumb = p.media_path
      ? (p.media_type === 'video'
          ? `<div class="thumb thumb-video">▶</div>`
          : `<img class="thumb" src="${mediaUrl(p.media_path)}" alt="">`)
      : `<div class="thumb thumb-empty"></div>`;
    tr.innerHTML = `
      <td>${thumb}</td>
      <td>
        <div class="row-title">${escapeHtml(p.title)}</div>
        <div class="row-snippet">${escapeHtml((p.content || '').slice(0, 90))}</div>
      </td>
      <td>${escapeHtml(p.platform)}</td>
      <td><span class="status status-${p.status}">${STATUSES[p.status]}</span></td>
      <td class="nowrap">${p.posted_at ? fmtDateTime(p.posted_at) : (p.scheduled_at ? '<span class="muted">Sched. ' + fmtDateTime(p.scheduled_at) + '</span>' : '—')}</td>
      <td class="num">${m ? fmtNum(m.impressions) : '—'}</td>
      <td class="num">${m ? fmtNum(m.clicks) : '—'}</td>
      <td class="num">${fmtCtr(m)}</td>
    `;
    tr.onclick = () => { location.href = '?post=' + encodeURIComponent(p.id); };
    rows.appendChild(tr);
  });
}

function renderSummary(list) {
  const latest = list.map(latestMetrics).filter(Boolean);
  const impressions = latest.reduce((s, m) => s + m.impressions, 0);
  const clicks = latest.reduce((s, m) => s + m.clicks, 0);
  const stats = [
    ['Posts', fmtNum(list.length)],
    ['Posted', fmtNum(list.filter(p => p.status === 'posted').length)],
    ['Impressions', fmtNum(impressions)],
    ['Clicks', fmtNum(clicks)],
    ['Avg. CTR', impressions ? ((clicks / impressions) * 100).toFixed(2) + '%' : '—'],
  ];
  document.getElementById('summary-row').innerHTML = stats.map(([label, value]) =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join('');
}

/* ---------------- post form (new + edit) ---------------- */

function postFormHtml(p, withMedia) {
  p = p || {};
  const platformOpts = PLATFORMS.map(x =>
    `<option ${x === (p.platform || 'Instagram') ? 'selected' : ''}>${escapeHtml(x)}</option>`).join('');
  const statusOpts = Object.entries(STATUSES).map(([k, v]) =>
    `<option value="${k}" ${k === (p.status || 'draft') ? 'selected' : ''}>${v}</option>`).join('');
  return `
    <div class="field"><label>Title (internal name)</label><input type="text" id="f-title" value="${escapeHtml(p.title || '')}" placeholder="e.g. Diwali offer — carousel 1"></div>
    <div class="form-row">
      <div class="field"><label>Platform</label><select id="f-platform">${platformOpts}</select></div>
      <div class="field"><label>Status</label><select id="f-status">${statusOpts}</select></div>
    </div>
    <div class="field"><label>Content / caption</label><textarea id="f-content" rows="6" placeholder="Write the post text, #hashtags included">${escapeHtml(p.content || '')}</textarea></div>
    ${withMedia ? `<div class="field"><label>Image or video (optional)</label><input type="file" id="f-media" accept="image/*,video/*"></div>` : ''}
    <div class="form-row">
      <div class="field"><label>Scheduled for</label><input type="datetime-local" id="f-scheduled" value="${toLocalInput(p.scheduled_at)}"></div>
      <div class="field"><label>Actually posted at</label><input type="datetime-local" id="f-posted" value="${toLocalInput(p.posted_at)}"></div>
    </div>
    <div class="field"><label>Live post URL (optional)</label><input type="text" id="f-url" value="${escapeHtml(p.post_url || '')}" placeholder="https://..."></div>
    <p class="hint">Filling in "Actually posted at" marks the post as Posted.</p>
  `;
}

function readPostForm(box) {
  const posted_at = fromLocalInput(box.querySelector('#f-posted').value);
  return {
    title: box.querySelector('#f-title').value.trim(),
    platform: box.querySelector('#f-platform').value,
    status: posted_at ? 'posted' : box.querySelector('#f-status').value,
    content: box.querySelector('#f-content').value,
    scheduled_at: fromLocalInput(box.querySelector('#f-scheduled').value),
    posted_at,
    post_url: box.querySelector('#f-url').value.trim() || null,
  };
}

function openNewPostModal() {
  openModal(`
    <h3>New Post</h3>
    ${postFormHtml(null, true)}
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Create Post</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const row = readPostForm(box);
      if (!row.title) { toast('Title is required'); return; }
      const saveBtn = box.querySelector('#f-save');
      saveBtn.disabled = true;
      const { data, error } = await sb.from('smm_posts').insert(row).select().single();
      if (error) { saveBtn.disabled = false; toast('Could not create post: ' + error.message); return; }
      const file = box.querySelector('#f-media').files[0];
      if (file) await uploadMedia(data, file);
      location.href = '?post=' + encodeURIComponent(data.id);
    };
  });
}

/* ================= DETAIL VIEW ================= */

async function loadPost(id) {
  const { data, error } = await sb.from('smm_posts').select('*, smm_metrics(*)').eq('id', id).single();
  if (error || !data) {
    document.getElementById('post-title').textContent = 'Not found';
    toast('Could not load post: ' + (error ? error.message : 'not found'));
    return;
  }
  currentPost = data;
  renderPost();
}

function renderPost() {
  const p = currentPost;
  document.getElementById('post-title').textContent = p.title;
  document.title = p.title + ' — Social Media Marketing';

  // Feed-style preview card
  const media = p.media_path
    ? (p.media_type === 'video'
        ? `<video src="${mediaUrl(p.media_path)}" controls playsinline></video>`
        : `<img src="${mediaUrl(p.media_path)}" alt="">`)
    : (viewOnly ? '' : '<div class="preview-nomedia">No image or video yet</div>');
  document.getElementById('post-preview').innerHTML = `
    <div class="pv-head">
      <div class="pv-avatar">${escapeHtml(p.platform.charAt(0))}</div>
      <div>
        <div class="pv-name">Your Brand</div>
        <div class="pv-meta">${escapeHtml(p.platform)} · ${p.posted_at ? fmtDateTime(p.posted_at) : (p.scheduled_at ? 'Scheduled ' + fmtDateTime(p.scheduled_at) : 'Draft')}</div>
      </div>
    </div>
    ${p.content ? `<div class="pv-text">${contentHtml(p.content)}</div>` : ''}
    ${media ? `<div class="pv-media">${media}</div>` : ''}
  `;

  const details = [
    ['Platform', escapeHtml(p.platform)],
    ['Status', `<span class="status status-${p.status}">${STATUSES[p.status]}</span>`],
    ['Scheduled for', fmtDateTime(p.scheduled_at)],
    ['Posted at', fmtDateTime(p.posted_at)],
    ['Live URL', p.post_url ? `<a href="${escapeHtml(p.post_url)}" target="_blank" rel="noopener">${escapeHtml(p.post_url)}</a>` : '—'],
  ];
  document.getElementById('post-details').innerHTML =
    details.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  document.getElementById('media-btn').textContent = p.media_path ? 'Replace media' : '+ Add image or video';
  document.getElementById('media-remove-btn').style.display = p.media_path ? '' : 'none';

  if (!viewOnly) renderMetrics();
}

function renderMetrics() {
  const list = sortedMetrics(currentPost);
  const latestEl = document.getElementById('metrics-latest');
  const wrap = document.getElementById('metrics-wrap');

  if (!list.length) {
    latestEl.innerHTML = '';
    wrap.innerHTML = '<div class="muted-block">No metrics logged yet. After the post goes live, click "+ Log Metrics" to record impressions and clicks — log again later to track growth.</div>';
    return;
  }

  const m = list[0];
  latestEl.innerHTML = [
    ['Impressions', fmtNum(m.impressions)],
    ['Clicks', fmtNum(m.clicks)],
    ['CTR', fmtCtr(m)],
    ['Engagement', fmtNum(m.likes + m.comments + m.shares)],
  ].map(([label, value]) =>
    `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`).join('') +
    `<div class="latest-note">As of ${fmtDate(m.recorded_on)}</div>`;

  wrap.innerHTML = `
    <table class="metrics-table">
      <thead><tr>
        <th>Date</th><th class="num">Impr.</th><th class="num">Clicks</th><th class="num">CTR</th>
        <th class="num">Likes</th><th class="num">Comm.</th><th class="num">Shares</th><th>Note</th><th></th>
      </tr></thead>
      <tbody>${list.map(r => `
        <tr>
          <td class="nowrap">${fmtDate(r.recorded_on)}</td>
          <td class="num">${fmtNum(r.impressions)}</td>
          <td class="num">${fmtNum(r.clicks)}</td>
          <td class="num">${fmtCtr(r)}</td>
          <td class="num">${fmtNum(r.likes)}</td>
          <td class="num">${fmtNum(r.comments)}</td>
          <td class="num">${fmtNum(r.shares)}</td>
          <td class="note-cell">${escapeHtml(r.note || '')}</td>
          <td class="nowrap"><button class="link-btn" data-edit="${r.id}">Edit</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
  wrap.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openMetricsModal(list.find(r => r.id === btn.dataset.edit));
  });
}

function openMetricsModal(existing) {
  const m = existing || {};
  const num = (id, label, v) =>
    `<div class="field"><label>${label}</label><input type="number" min="0" step="1" id="${id}" value="${v || 0}"></div>`;
  openModal(`
    <h3>${existing ? 'Edit Metrics' : 'Log Metrics'}</h3>
    <div class="field"><label>Recorded on</label><input type="date" id="m-date" value="${m.recorded_on || todayStr()}"></div>
    <div class="form-row">${num('m-impressions', 'Impressions', m.impressions)}${num('m-clicks', 'Clicks', m.clicks)}</div>
    <div class="form-row">${num('m-likes', 'Likes', m.likes)}${num('m-comments', 'Comments', m.comments)}${num('m-shares', 'Shares', m.shares)}</div>
    <div class="field"><label>Note (optional)</label><input type="text" id="m-note" value="${escapeHtml(m.note || '')}" placeholder="e.g. boosted ₹500 on day 2"></div>
    <div class="form-actions">
      ${existing ? '<button class="btn btn-danger" id="m-delete" style="margin-right:auto;">Delete</button>' : ''}
      <button class="btn" id="m-cancel">Cancel</button>
      <button class="btn btn-primary" id="m-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#m-cancel').onclick = closeModal;
    const intVal = (id) => Math.max(0, parseInt(box.querySelector(id).value, 10) || 0);
    box.querySelector('#m-save').onclick = async () => {
      const recorded_on = box.querySelector('#m-date').value;
      if (!recorded_on) { toast('Pick a date'); return; }
      const row = {
        recorded_on,
        impressions: intVal('#m-impressions'),
        clicks: intVal('#m-clicks'),
        likes: intVal('#m-likes'),
        comments: intVal('#m-comments'),
        shares: intVal('#m-shares'),
        note: box.querySelector('#m-note').value.trim() || null,
      };
      if (row.clicks > row.impressions && !confirm('Clicks are higher than impressions. Save anyway?')) return;
      const { error } = existing
        ? await sb.from('smm_metrics').update(row).eq('id', existing.id)
        : await sb.from('smm_metrics').insert({ ...row, post_id: currentPost.id });
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      toast('Saved');
      await loadPost(currentPost.id);
    };
    const del = box.querySelector('#m-delete');
    if (del) del.onclick = async () => {
      if (!confirm('Delete this metrics entry?')) return;
      const { error } = await sb.from('smm_metrics').delete().eq('id', existing.id);
      if (error) { toast('Could not delete: ' + error.message); return; }
      closeModal();
      await loadPost(currentPost.id);
    };
  });
}

function openEditPostModal() {
  openModal(`
    <h3>Edit Post</h3>
    ${postFormHtml(currentPost, false)}
    <div class="form-actions">
      <button class="btn" id="f-cancel">Cancel</button>
      <button class="btn btn-primary" id="f-save">Save</button>
    </div>
  `, (box) => {
    box.querySelector('#f-cancel').onclick = closeModal;
    box.querySelector('#f-save').onclick = async () => {
      const row = readPostForm(box);
      if (!row.title) { toast('Title is required'); return; }
      row.updated_at = new Date().toISOString();
      const { error } = await sb.from('smm_posts').update(row).eq('id', currentPost.id);
      if (error) { toast('Could not save: ' + error.message); return; }
      closeModal();
      toast('Saved');
      await loadPost(currentPost.id);
    };
  });
}

async function deleteCurrentPost() {
  if (!confirm('Delete "' + currentPost.title + '" and all its metrics? This cannot be undone.')) return;
  if (currentPost.media_path) await sb.storage.from('media').remove([currentPost.media_path]);
  const { error } = await sb.from('smm_posts').delete().eq('id', currentPost.id);
  if (error) { toast('Could not delete: ' + error.message); return; }
  location.href = location.pathname;
}

function sharePost() {
  const url = location.origin + location.pathname + '?post=' + encodeURIComponent(currentPost.id) + '&mode=view';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Share link copied to clipboard'));
  } else {
    prompt('Copy this link:', url);
  }
}

/* ---------------- media (one image or video per post) ---------------- */

async function uploadMedia(post, file) {
  const isVideo = file.type.startsWith('video/');
  const path = `smm/${post.id}/${crypto.randomUUID()}-${file.name}`;

  toast('Uploading…');
  const { error: upErr } = await sb.storage.from('media').upload(path, file);
  if (upErr) { toast('Upload failed: ' + upErr.message); return false; }

  const { error } = await sb.from('smm_posts').update({
    media_path: path,
    media_type: isVideo ? 'video' : 'image',
    updated_at: new Date().toISOString(),
  }).eq('id', post.id);
  if (error) { toast('Could not save media: ' + error.message); return false; }

  // Replacing: drop the old file only once the new one is saved.
  if (post.media_path) await sb.storage.from('media').remove([post.media_path]);
  toast('Uploaded');
  return true;
}

async function removeMedia() {
  if (!confirm('Remove this image/video from the post?')) return;
  await sb.storage.from('media').remove([currentPost.media_path]);
  const { error } = await sb.from('smm_posts')
    .update({ media_path: null, media_type: null, updated_at: new Date().toISOString() })
    .eq('id', currentPost.id);
  if (error) { toast('Could not remove: ' + error.message); return; }
  await loadPost(currentPost.id);
}

/* ---------------- Excel export ----------------
   Two sheets: "Posts" (one row per post with its latest figures) and
   "Metrics Log" (every snapshot ever logged). Exports whatever the list
   filters currently show. */

function exportExcel() {
  if (typeof XLSX === 'undefined') { toast('Excel library failed to load — check your connection'); return; }
  const list = filteredPosts();
  if (!list.length) { toast('No posts to export'); return; }

  const asDate = (iso) => iso ? new Date(iso) : '';
  const pct = (m) => { const v = ctr(m); return v == null ? '' : Number(v.toFixed(2)); };

  const postRows = list.map(p => {
    const m = latestMetrics(p) || {};
    return {
      'Title': p.title,
      'Platform': p.platform,
      'Status': STATUSES[p.status],
      'Scheduled For': asDate(p.scheduled_at),
      'Posted At': asDate(p.posted_at),
      'Post URL': p.post_url || '',
      'Content': p.content || '',
      'Media Type': p.media_type || '',
      'Media URL': mediaUrl(p.media_path),
      'Metrics As Of': m.recorded_on ? new Date(m.recorded_on + 'T00:00:00') : '',
      'Impressions': m.impressions ?? '',
      'Clicks': m.clicks ?? '',
      'CTR %': pct(m),
      'Likes': m.likes ?? '',
      'Comments': m.comments ?? '',
      'Shares': m.shares ?? '',
      'Created': asDate(p.created_at),
    };
  });

  const logRows = [];
  list.forEach(p => {
    sortedMetrics(p).reverse().forEach(m => {
      logRows.push({
        'Post': p.title,
        'Platform': p.platform,
        'Posted At': asDate(p.posted_at),
        'Recorded On': new Date(m.recorded_on + 'T00:00:00'),
        'Impressions': m.impressions,
        'Clicks': m.clicks,
        'CTR %': pct(m),
        'Likes': m.likes,
        'Comments': m.comments,
        'Shares': m.shares,
        'Note': m.note || '',
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const postsSheet = XLSX.utils.json_to_sheet(postRows, { cellDates: true, dateNF: 'yyyy-mm-dd hh:mm' });
  postsSheet['!cols'] = [28, 12, 10, 18, 18, 30, 50, 10, 40, 14, 12, 10, 8, 8, 10, 8, 18].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, postsSheet, 'Posts');

  const logSheet = XLSX.utils.json_to_sheet(logRows.length ? logRows : [{ 'Post': 'No metrics logged yet' }], { cellDates: true, dateNF: 'yyyy-mm-dd' });
  logSheet['!cols'] = [28, 12, 18, 14, 12, 10, 8, 8, 10, 8, 30].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, logSheet, 'Metrics Log');

  XLSX.writeFile(wb, `social-media-report-${todayStr()}.xlsx`);
}

/* ---------------- static button wiring ---------------- */

function wireStaticButtons() {
  const byId = (id) => document.getElementById(id);
  byId('new-post-btn').onclick = openNewPostModal;
  byId('export-btn').onclick = exportExcel;
  byId('filter-platform').onchange = renderPostList;
  byId('filter-status').onchange = renderPostList;
  byId('back-btn').onclick = () => { location.href = location.pathname; };
  byId('share-btn').onclick = sharePost;
  byId('edit-btn').onclick = openEditPostModal;
  byId('delete-btn').onclick = deleteCurrentPost;
  byId('add-metrics-btn').onclick = () => openMetricsModal(null);
  byId('media-remove-btn').onclick = removeMedia;
  byId('media-input').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file && await uploadMedia(currentPost, file)) await loadPost(currentPost.id);
  };
}
