// Add a new entry here whenever you build a new tool in tools/<slug>/index.html.
const TOOLS = [
  {
    name: 'Widget Scenario Specs',
    description: 'Document widget/feature UX scenarios — triggers, messages, popups, backend behavior — for manager review.',
    icon: '🧩',
    href: 'tools/widget-scenario-spec/index.html',
  },
];

let sb;

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
  renderTools();
}

function renderTools() {
  const grid = document.getElementById('tool-grid');
  grid.innerHTML = '';
  TOOLS.forEach(tool => {
    const card = document.createElement('a');
    card.className = 'tool-card';
    card.href = tool.href;
    card.innerHTML = `
      <div class="tool-icon">${tool.icon}</div>
      <h3>${tool.name}</h3>
      <p>${tool.description}</p>
    `;
    grid.appendChild(card);
  });
}
