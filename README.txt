WIDGET SCENARIO SPEC — HOW TO USE
==================================

WHAT THIS IS NOW
-----------------
This is a small app for documenting widget/feature scenarios so a manager
can click through them. It now supports MULTIPLE projects, created from
the browser itself — no more hand-editing a JSON file. Each project has:
  - a title + description (+ optional problem statement / placement)
  - categories, each with scenarios (trigger / message / popup / backend)
  - screenshots or short videos attached to each scenario, uploaded
    straight from the file picker
  - a "Download PDF" button that exports the whole project (all
    categories, scenarios, and screenshots) as a PDF you can email
    directly — no hosting/deployment needed for this
  - a "Share" button that copies a link straight to that project
    (only useful if you deploy this app somewhere reachable by the
    person you're sending it to — see the PDF option below if not)

Data lives in a free Supabase project (Postgres database + file storage),
not in a local JSON file. The pages themselves (index.html/app.js/style.css)
are still a plain static site you can host anywhere, e.g. Vercel.

There is no login right now. Anyone with the app URL and Supabase anon key
(the values in config.js) can view and edit. Don't put anything sensitive
in here, and don't hand config.js out beyond people you trust. (A shared
password / login can be added back later if needed — ask if you want it.)


ONE-TIME SETUP: CREATE YOUR SUPABASE PROJECT
-----------------------------------------------
1. Go to https://supabase.com, sign up / log in, click "New Project".
   Pick any name/region/password (the password is only for direct DB
   access, you won't need it for this app).
2. Wait ~1-2 minutes for the project to finish provisioning.
3. Open the SQL Editor (left sidebar) -> "New query".
4. Open supabase-schema.sql from this folder, copy its entire contents,
   paste into the SQL editor, and click "Run".
   This creates the tables (projects, categories, scenarios, media),
   a public "media" storage bucket for screenshots/videos, and the
   access policies described above (public read + write, no login).
5. Go to Project Settings -> API. Copy the "Project URL" and the
   "anon public" API key.
6. Open config.js in this folder and paste those two values in:

     const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
     const SUPABASE_ANON_KEY = "eyJ...";

That's it — the app is now wired to your database.


RUNNING IT LOCALLY
-------------------
Browsers block fetch()/module-style requests over file://. Run a tiny
local server from this folder instead, e.g.:

  python -m http.server 8000

then open http://localhost:8000 in your browser.

(Or, if you have Node: npx serve)


USING THE APP
---------------
- On open, you'll see a grid of all projects. Click "+ New Project" to
  create one (title + description, problem statement and placement are
  optional).
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
    read-only view — only useful once this app is deployed somewhere
    reachable by whoever you send it to (see below). If that's not an
    option for you, use "Download PDF" instead.
  - "Edit" / "Delete" on the project, and the delete controls on
    categories/scenarios/media, let you manage content as it evolves.


SHARING WITHOUT DEPLOYING (Vercel/GitHub not available to you)
------------------------------------------------------------------
If you can't install Git/Node or use Vercel/GitHub (e.g. restricted
work machine), you don't need them. Run the app locally
(see "RUNNING IT LOCALLY" above), open the project, and click
"Download PDF" — that produces a normal PDF file you can send by email
like any other document. The database still lives in Supabase, so you
can keep editing and re-export an updated PDF any time.


DEPLOYING TO VERCEL (optional — only if you want a live shareable link)
---------------------------------------------------------------------------
1. Install Vercel CLI once:  npm i -g vercel
2. Make sure config.js has your real Supabase URL/key filled in
   (see setup steps above) — Vercel just serves these static files,
   Supabase is the backend.
3. From this folder, run:    vercel
4. Follow the prompts (first time it'll ask to log in / link a project).
5. You'll get a shareable URL. Open it, go into a project, click
   "Share", and send that per-project link.

Since the data lives in Supabase (not in files), you generally don't
need to redeploy after adding projects/scenarios/media — only redeploy
if you change index.html, app.js, style.css, or config.js.


LEGACY FILES
-------------
scenarios.json and any images/ folder from the old single-project,
hand-edited version of this tool are no longer read by the app. You can
delete them once you've recreated that content as a project in the app,
or keep them around for reference.
