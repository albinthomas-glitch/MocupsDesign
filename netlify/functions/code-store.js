// Server-side proxy for the Code Store tool's GitHub Contents API calls.
// GITHUB_TOKEN lives only in this function's environment (Netlify's Site
// configuration -> Environment variables) and is never sent to the
// browser. Every request must carry a valid Supabase session token,
// checked against Supabase's own /auth/v1/user endpoint, so only someone
// actually logged into the portal can use it.

const GITHUB_API = 'https://api.github.com';

// Not secret -- the same anon key already shipped in config.js, safe by
// design via Supabase row-level security. Keep this in sync with config.js
// if you ever rotate your Supabase project.
const SUPABASE_URL = 'https://wvlpvggawyppccrrqwli.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bHB2Z2dhd3lwcGNjcnJxd2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTQ0MzAsImV4cCI6MjEwMDg5MDQzMH0.9ojeFRZpERhwL-t2txj1qKhG8pBZ131htkLPHW8fzQA';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const sessionToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!sessionToken) {
    return json(401, { error: 'Not logged in' });
  }

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${sessionToken}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) {
    return json(401, { error: 'Session expired, please log in again' });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return json(500, { error: 'GITHUB_TOKEN is not set in this site\'s environment variables' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const { action, owner, repo, branch, path: folder, filename, code, sha } = payload;
  if (!owner || !repo || !branch || !folder) {
    return json(400, { error: 'Missing owner/repo/branch/path' });
  }
  if (filename && (filename.includes('/') || filename.includes('\\'))) {
    return json(400, { error: 'Filename cannot contain slashes' });
  }

  const ghHeaders = (withJsonType) => {
    const h = { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' };
    if (withJsonType) h['Content-Type'] = 'application/json';
    return h;
  };

  try {
    if (action === 'list') {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${folder}?ref=${branch}`;
      const res = await fetch(url, { headers: ghHeaders(false) });
      if (res.status === 404) return json(200, []);
      const data = await res.json();
      if (!res.ok) return json(res.status, { error: data.message });
      return json(200, Array.isArray(data) ? data.filter((f) => f.type === 'file') : []);
    }

    if (action === 'get') {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${folder}/${filename}?ref=${branch}`;
      const res = await fetch(url, { headers: ghHeaders(false) });
      const data = await res.json();
      if (!res.ok) return json(res.status, { error: data.message });
      return json(200, {
        name: data.name,
        path: data.path,
        sha: data.sha,
        text: Buffer.from(data.content, 'base64').toString('utf-8'),
      });
    }

    if (action === 'save') {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${folder}/${filename}`;
      const body = {
        message: sha ? `Update snippet: ${filename}` : `Add snippet: ${filename}`,
        content: Buffer.from(code || '', 'utf-8').toString('base64'),
        branch,
      };
      if (sha) body.sha = sha;
      const res = await fetch(url, { method: 'PUT', headers: ghHeaders(true), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return json(res.status, { error: data.message });
      return json(200, data);
    }

    if (action === 'delete') {
      const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${folder}/${filename}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: ghHeaders(true),
        body: JSON.stringify({ message: `Delete snippet: ${filename}`, sha, branch }),
      });
      if (!res.ok) {
        const data = await res.json();
        return json(res.status, { error: data.message });
      }
      return json(200, { ok: true });
    }

    return json(400, { error: 'Unknown action' });
  } catch (err) {
    return json(500, { error: err.message });
  }
};

function json(statusCode, data) {
  return { statusCode, body: JSON.stringify(data) };
}
