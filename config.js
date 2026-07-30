// Fill these in after creating your Supabase project.
// Dashboard -> Project Settings -> API -> "Project URL" and "anon public" key.
// This is a public key by design (Supabase's row-level security controls
// what it's allowed to do) -- it is safe to ship in client-side code.
const SUPABASE_URL = "https://wvlpvggawyppccrrqwli.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bHB2Z2dhd3lwcGNjcnJxd2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzMTQ0MzAsImV4cCI6MjEwMDg5MDQzMH0.9ojeFRZpERhwL-t2txj1qKhG8pBZ131htkLPHW8fzQA";

// The single shared login account (Supabase Auth -> Users -> Add user).
// The email itself isn't shown to anyone -- only the password is asked for
// on the login screen. Any unique email works; it doesn't need to be real.
const SHARED_LOGIN_EMAIL = "testop99QA@gmail.com";

// ---- Code Store tool (tools/code-store/) ----
// Unlike the Supabase anon key above, this token is NOT safe by design --
// it grants direct access to whatever it's scoped to. It still ships to
// the browser because this is a static site with no server, so:
//   - Create a FINE-GRAINED token (github.com/settings/tokens?type=beta),
//     scoped to ONLY the one repo below, with Contents: Read and write
//     permission and nothing else.
//   - Prefer a dedicated/private repo for snippets, not a repo with
//     anything sensitive elsewhere in it.
//   - Anyone who can view this file's contents (i.e. anyone logged into
//     this portal) can use this token, so trust here = trust in the portal
//     login, same as everything else in this app.
const GITHUB_TOKEN = "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";
const GITHUB_OWNER = "albinthomas-glitch";
const GITHUB_REPO = "MocupsDesign-";
const GITHUB_BRANCH = "main";
const GITHUB_SNIPPETS_PATH = "snippets";
