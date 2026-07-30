// Runs during the Vercel build only (see vercel.json). Turns the
// GITHUB_TOKEN environment variable (set in Vercel Project Settings ->
// Environment Variables, never in git) into config.local.js, the same
// file you'd otherwise create by hand for local dev.
const fs = require('fs');

const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.warn(
    'GITHUB_TOKEN environment variable is not set for this deploy -- ' +
    'Code Store will show "Not configured yet" here. Set it in Vercel ' +
    'Project Settings -> Environment Variables and redeploy if you want ' +
    'Code Store to work on this URL.'
  );
  process.exit(0);
}

fs.writeFileSync('config.local.js', `const GITHUB_TOKEN = ${JSON.stringify(token)};\n`);
console.log('Generated config.local.js for this deploy.');
