TOOLS PORTAL — HOW TO USE
==========================

WHAT THIS IS NOW
-----------------
This is a password-protected portal that can hold multiple, unrelated
tools. Open it, log in once, and you land on a menu of tool cards. There
are three so far:
  - "Widget Scenario Specs" (documents widget/feature UX scenarios —
    trigger / message / popup / backend — for manager review, with
    screenshots or short videos, PDF export, and share links).
  - "Code Store" (paste code, preview it with syntax highlighting, and
    save it as a snippet).
  - "DocCust_Editior" (documents made of locked and editable sections;
    every edit to an editable section is kept forever along with a
    required retrospective remark on its real-world impact, and the
    last 2 edits per section can be restored with one click).
You can add more tools later; see "ADDING A NEW TOOL" below.

Layout:
  index.html, portal.js, portal.css   -> the portal itself (login + menu)
  theme.css                           -> shared design tokens/buttons/forms/
                                          modal/toast/login styling, used by
                                          the portal and every tool
  config.js                           -> your Supabase project URL/key +
                                          shared login email (one config for
                                          the whole portal and all tools)
  supabase-schema.sql                 -> database setup script
  tools/widget-scenario-spec/         -> Widget Scenario Specs, self-contained
                                          (index.html, app.js, style.css)
  tools/code-store/                   -> Code Store, self-contained
                                          (index.html, app.js, style.css)
  tools/doccust-editor/               -> DocCust_Editior, self-contained
                                          (index.html, app.js, style.css)

Data lives in a free Supabase project (Postgres database + file storage),
not in local files. The pages themselves are a plain static site you can
host anywhere, e.g. Netlify, or just run locally.

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
   This creates the tables both tools need (including Code Store's
   "snippets" table and its menu card), a public "media" storage bucket
   for screenshots/videos, and the access policies described above
   (public read, login-required write).
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


USING THE CODE STORE TOOL
-----------------------------
No separate setup needed -- Code Store uses the same Supabase project as
everything else (the "snippets" table from supabase-schema.sql). Running
that schema also seeds Code Store's menu card automatically, so it should
already show up on the portal menu.
- You'll see a grid of saved snippets. Click "+ New Snippet" to add one:
  give it a filename (e.g. main.py, helper.js) and paste the code.
- Click a snippet to open it. Two tabs:
  - "Code" — syntax-highlighted read-only view (auto-detected language,
    via highlight.js).
  - "Preview" — for HTML/CSS/JS snippets, renders the code as an actual
    live page in a sandboxed frame (the previewed code can't reach or
    affect the portal itself, even if it has its own scripts). The page
    is fully interactive by default — buttons, links, and any JS-driven
    UI behave like the real thing, same as clicking around an actual
    mockup. To leave a remark instead, click "+ Add Remark" above the
    preview first — it arms one click (the button changes to "Cancel"
    and the frame gets a dashed outline as a reminder); your next click
    in the preview is captured instead of reaching the page, and the
    frame goes back to being interactive right after. This is read-only
    review of the code itself: there's no way to edit the code from
    this tab, only interact with it and mark it up.
    Remarks are saved per snippet (in the "snippet_comments" table) and
    are still there next time you open it, drawn as an outlined box in
    the same spot. Click an existing box (or its entry in the list below
    the preview) to edit it, mark it "done", or delete it — clicking an
    existing box always opens it, with no need to arm anything first. A
    remark's position/size is stored as a percentage of the page, not
    tied to the exact element, so it stays roughly in place even after
    you go edit the code — a big layout change can still leave a box
    looking slightly off.
- "Copy" copies the raw code to your clipboard.
- "Share" copies a link that opens this snippet in a scoped-down view, no
  login needed — useful for sending to someone (e.g. a backend developer)
  to review and comment on the interactive mockup without giving them
  portal access or the raw source. In this view: only the Preview tab is
  reachable (the Code tab and "Copy" are hidden — the file's raw source
  isn't handed over just to collect feedback), the preview is fully
  interactive, and "+ Add Remark" is available, so the recipient can add
  new remarks without logging in. "Edit", "Delete", and "Share" for the
  snippet itself stay hidden, and clicking an *existing* remark's box
  only lets you view it, not edit/delete/resolve it — adding new remarks
  is the one write action a share link can do.
  (Note: hiding the Code tab only removes the UI affordance — the
  snippet's code is still public-read in Supabase, the same as it has to
  be for the live preview to render at all, so this isn't a real access
  boundary against a determined recipient with browser dev tools, just a
  normal-use convenience.)
- "Edit" lets you change the filename and/or code; saving updates the row
  in Supabase. "Delete" removes the snippet and any remarks on it.


USING THE DOCCUST_EDITIOR TOOL
----------------------------------
- You'll see a grid of documents. Click "+ New Document" to create one
  (title + optional description).
- Click a document card to open it. Inside a document:
  - "+ Add Section" creates a section ("block") with a name, an initial
    piece of text, and a Locked/Editable toggle.
    - Locked sections are fixed reference text: "Edit" changes the text
      directly, no history is kept, no remark is ever asked for. Use
      this for parts that shouldn't be tracked (headings, prices, terms
      that don't change often).
    - Editable sections are where the tracking happens (see below).
  - "Settings" on a section lets you rename it or flip Locked/Editable.
    Switching to Locked freezes whatever text is currently showing;
    switching to Editable starts a fresh edit history from that text.
  - "Delete" on a section removes it and its entire history.
- On an editable section:
  - Every saved edit is appended to that section's history forever —
    nothing is ever deleted. "Show History" reveals the full log,
    newest first, each entry showing its text and its remark (or "No
    remark yet" if one hasn't been written).
  - You can't make a new edit until the section's most recent edit has
    a remark. The "Edit" button is disabled and a banner appears asking
    for the remark first — click "Add Remark" (on the banner or on the
    current entry in History) to write it. The remark is meant to
    capture the real-world impact once you actually know it, which may
    be written well after the edit itself, but it has to exist before
    you're allowed to edit that section again.
  - Only the 2 most recent history entries are one-click restorable —
    the "Restore" button appears on the second-most-recent entry (the
    one just before the current text). Older entries stay fully visible
    with their text and remark, just without a Restore button; you'd
    copy that text back in manually via a fresh edit if you needed it.
  - Restoring counts as a new edit itself: it's appended to the history
    and needs its own remark before the section can be edited again.


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


SHARING WITHOUT DEPLOYING (Netlify/GitHub not available to you)
------------------------------------------------------------------
If you can't install Git/Node or use Netlify/GitHub (e.g. restricted
work machine), you don't need them. Run the app locally
(see "RUNNING IT LOCALLY" above), open a project in the Widget Scenario
Specs tool, and click "Download PDF" — that produces a normal PDF file
you can send by email like any other document. The database still lives
in Supabase, so you can keep editing and re-export an updated PDF any
time.


DEPLOYING TO NETLIFY (optional — only if you want a live shareable link)
---------------------------------------------------------------------------
Easiest: connect the GitHub repo in the Netlify dashboard (Add new site ->
Import an existing project -> pick this repo). Netlify will read
netlify.toml automatically (publish directory `.`) and deploy on every
push to main.

Or via CLI:
1. Install Netlify CLI once:  npm i -g netlify-cli
2. Make sure config.js has your real Supabase URL/key/login email filled
   in (see setup steps above) — Netlify just serves these static files,
   Supabase is the backend.
3. From this folder, run:    netlify deploy --prod
4. Follow the prompts (first time it'll ask to log in / link a site).
5. You'll get a shareable URL. Log in, open a project, click "Share",
   and send that per-project link.

Since the data lives in Supabase (not in files), you generally don't
need to redeploy after adding projects/scenarios/media/snippets — only
redeploy if you change any of the .html/.js/.css files.


LEGACY FILES
-------------
tools/widget-scenario-spec/scenarios.json is left over from the original
single-project, hand-edited version of this tool and is no longer read
by the app. Delete it whenever you like, or keep it for reference.
