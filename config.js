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
