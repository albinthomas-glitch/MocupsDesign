TOOLS PORTAL — HOW TO USE
==========================

WHAT THIS IS NOW
-----------------
This is a password-protected portal that can hold multiple, unrelated
tools. Open it, log in once, and you land on a menu of tool cards. Right
now there's one: "Widget Scenario Specs" (documents widget/feature UX
scenarios — trigger / message / popup / backend — for manager review,
with screenshots or short videos, PDF export, and share links). You can
add more tools later; see "ADDING A NEW TOOL" below.

Layout:
  index.html, portal.js, portal.css   -> the portal itself (login + menu)
  theme.css                           -> shared design tokens/buttons/forms/
                                          modal/toast/login styling, used by
                                          the portal and every tool
  config.js                           -> your Supabase project URL/key +
                                          shared login email (one config
                                          for the whole portal and all tools)
  supabase-schema.sql                 -> database setup script
  tools/widget-scenario-spec/         -> the first tool, self-contained
                                          (index.html, app.js, style.css)

Data lives in a free Supabase project (Postgres database + file storage),
not in local files. The pages themselves are a plain static site you can
host anywhere, e.g. Vercel, or just run locally.

The whole portal is behind a single shared password, enforced by Supabase
Auth (a real login, not just a hidden UI element) — so writes are only
possible once someone has actually signed in. The one exception is a
tool's "Share" links (?mode=view): those open straight to a read-only
view with no password prompt, so whoever you send it to isn't blocked.
Reading data is always public (needed for share links); only
creating/editing/deleting requires login.


ONE-TIME SETUP: CREATE YOUR SUPABASE PROJECT
-----------------------------------------------
1. Go to https://supabase.com, sign up / log in, click "New Project".
   Pick any name/region/password (the password is only for direct DB
   access, you won't need it for this app).
2. Wait ~1-2 minutes for the project to finish provisioning.
3. Open the SQL Editor (left sidebar) -> "New query".
4. Open supabase-schema.sql from this folder, copy its entire contents,
   paste into the SQL editor, and click "Run".
   This creates the tables the Widget Scenario Specs tool needs, a
   public "media" storage bucket for screenshots/videos, and the access
   policies described above (public read, login-required write).
5. Go to Project Settings -> API. Copy the "Project URL" and the
   "anon public" API key.
6. Open config.js in this folder and paste those two values in:

     const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
     const SUPABASE_ANON_KEY = "eyJ...";

7. Create the shared login account: Authentication -> Users -> Add user.
   Enter any email (it doesn't need to be real, e.g. team@yourapp.local)
   and choose the password you want to use to get into the portal.
   Check "Auto Confirm User" so it's usable immediately.
8. Back in config.js, set SHARED_LOGIN_EMAIL to the exact email you used
   in step 7:

     const SHARED_LOGIN_EMAIL = "team@yourapp.local";

That's it — the portal is now wired to your database, and the login
screen will accept the password you chose in step 7.


RUNNING IT LOCALLY
-------------------
Browsers block fetch()/module-style requests over file://. Run a tiny
local server from this folder instead, e.g.:

  python -m http.server 8000

then open http://localhost:8000 in your browser.

(Or, if you have Node: npx serve)


USING THE PORTAL
------------------
- On open, you'll be asked for the shared password. Log in once per
  browser — the session persists until you click "Log out".
- After logging in, you'll see a grid of tool cards. Click one to open it.
- Every tool has a "Tools Menu" link to come back here.


USING THE WIDGET SCENARIO SPECS TOOL
----------------------------------------
- You'll see a grid of projects. Click "+ New Project" to create one
  (title + description, problem statement and placement are optional).
- Click a project card to open it. Inside a project:
  - "+ Add Category" in the sidebar groups related scenarios
    (e.g. "Time Selection", "Edge Cases").
  - "+ Add Scenario" under a category opens a form for trigger,
    message sent, popup shown, and backend behavior.
  - Click a scenario to view/edit it, and use "+ Add screenshot or
    video" to upload mockups directly — images and short video clips
    are both supported.
  - "Download PDF" (top of sidebar) exports the entire project as a
    PDF and opens your browser's print dialog — choose "Save as PDF"
    (or "Microsoft Print to PDF") as the destination instead of an
    actual printer, then email the resulting file. Screenshots are
    included; videos are noted by name but can't be embedded in a PDF.
  - "Share" (top of sidebar) copies a link that opens the project in
    read-only view, no login needed — only useful once this app is
    deployed somewhere reachable by whoever you send it to (see below).
    If that's not an option for you, use "Download PDF" instead.
  - "Edit" / "Delete" on the project, and the delete controls on
    categories/scenarios/media, let you manage content as it evolves.


ADDING A NEW TOOL
-------------------
Adding a tool is two separate things: registering its menu card (no code,
done from the portal itself), and building what it actually links to
(requires code — this doesn't build the tool for you).

Registering the card:
- Click "+ Add Tool" on the menu. Fill in a name, pick an icon from the
  picker, write a short description, and set the Link — the path the
  card opens (e.g. tools/your-tool-slug/index.html) once you've built it.
- "Edit" / "Delete" on any card let you update or remove it later. This
  is all stored in Supabase (the "tools" table), not in a file, so it's
  the same for everyone who logs into the portal.

Building the tool behind the link:
1. Create a new folder: tools/<your-tool-slug>/
2. Build it as its own self-contained index.html/app.js/style.css inside
   that folder, same pattern as tools/widget-scenario-spec/:
   - Link ../../theme.css before your own style.css to inherit the
     shared look (buttons, forms, modal, toast).
   - Load ../../config.js for Supabase access.
   - On load, check `await sb.auth.getSession()`; if there's no session,
     redirect to `../../index.html` so the portal login gates it too
     (skip this check for any read-only/share-link mode you add).
   - Add a "Tools Menu" link back to ../../index.html.
3. If your tool needs its own database tables, add them to
   supabase-schema.sql (or a new .sql file) following the same
   public-read / authenticated-write policy pattern, and re-run it in
   the Supabase SQL Editor.

You can register the card before or after building the tool — an
unbuilt link just 404s until the folder exists.


SHARING WITHOUT DEPLOYING (Vercel/GitHub not available to you)
------------------------------------------------------------------
If you can't install Git/Node or use Vercel/GitHub (e.g. restricted
work machine), you don't need them. Run the app locally
(see "RUNNING IT LOCALLY" above), open a project in the Widget Scenario
Specs tool, and click "Download PDF" — that produces a normal PDF file
you can send by email like any other document. The database still lives
in Supabase, so you can keep editing and re-export an updated PDF any
time.


DEPLOYING TO VERCEL (optional — only if you want a live shareable link)
---------------------------------------------------------------------------
1. Install Vercel CLI once:  npm i -g vercel
2. Make sure config.js has your real Supabase URL/key/login email filled
   in (see setup steps above) — Vercel just serves these static files,
   Supabase is the backend.
3. From this folder, run:    vercel
4. Follow the prompts (first time it'll ask to log in / link a project).
5. You'll get a shareable URL. Log in, open a project, click "Share",
   and send that per-project link.

Since the data lives in Supabase (not in files), you generally don't
need to redeploy after adding projects/scenarios/media — only redeploy
if you change any of the .html/.js/.css files.


LEGACY FILES
-------------
tools/widget-scenario-spec/scenarios.json is left over from the original
single-project, hand-edited version of this tool and is no longer read
by the app. Delete it whenever you like, or keep it for reference.
