# EQ GYM Phase 1 — Accounts + EQ Assessment + Data Sync — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. This codebase is a single static `index.html` with inline JS (no unit-test framework). "Verification" here = `node --check` on extracted JS + Puppeteer headless smoke tests + Supabase SQL executed by the owner. Follow tasks in order; commit after each task.

**Goal:** Add user accounts (Supabase Auth), an in-app EQ assessment quiz with scoring/report, and per-account data sync — while keeping the app fully working in "local mode" until Supabase is configured.

**Architecture:** Keep the single-file frontend on GitHub Pages. Load Supabase JS SDK via CDN `<script>` (global `supabase`). A config block (`SUPA_URL`, `SUPA_ANON`) feature-detects backend: empty → current localStorage behavior + open access; filled → Auth + Postgres sync + freemium gating. Data access goes through a thin `Store` layer that reads/writes localStorage always and mirrors to Supabase when signed in.

**Tech Stack:** HTML/CSS/vanilla JS (existing), `@supabase/supabase-js@2` (CDN UMD), Supabase (Postgres + Auth + RLS), Gemini (existing). Verification: Node syntax check + Puppeteer.

---

## File structure

- Modify: `index.html` — add config block, Supabase init, `Store` layer, quiz view, auth modal, gating; wire existing `save()/load()` through `Store`.
- Create: `supabase/schema.sql` — tables + RLS policies (owner runs in Supabase SQL editor).
- Create: `docs/SETUP-SUPABASE.md` — step-by-step owner setup guide.
- Create (scratch, not committed): puppeteer smoke scripts.

---

### Task 1: Config block + Supabase init + graceful fallback

**Files:** Modify `index.html` (add near top of `<script>`, before state).

- [ ] **Step 1:** Add CDN script tag in `<head>` (or before main script):
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
- [ ] **Step 2:** Add config + init:
```js
const SUPA_URL="";   // ← dán Supabase Project URL
const SUPA_ANON="";  // ← dán Supabase anon public key
const BACKEND = !!(SUPA_URL && SUPA_ANON && window.supabase);
let sb = BACKEND ? window.supabase.createClient(SUPA_URL, SUPA_ANON) : null;
let AUTH = null; // current session user or null
```
- [ ] **Step 3:** Verify: `node --check` on extracted JS passes; app loads in browser with empty config (local mode), no console errors.
- [ ] **Step 4:** Commit.

---

### Task 2: `Store` data layer (localStorage + optional Supabase mirror)

**Files:** Modify `index.html`.

- [ ] **Step 1:** Wrap existing state persistence. Keep `save()` writing localStorage; add async mirror:
```js
async function syncPush(){ if(!BACKEND||!AUTH) return;
  try{
    await sb.from('progress').upsert({user_id:AUTH.id, done:S.done, bounty:S.bounty,
      streak:S.streak, last_date:S.last, graded:S.graded, scen:S.scen, updated_at:new Date().toISOString()});
  }catch(e){ console.warn('sync progress',e); }
}
async function pushPractice(n,rec){ if(!BACKEND||!AUTH) return;
  try{ await sb.from('practices').insert({user_id:AUTH.id, lesson_n:n, scenario:rec.scenario,
    answer:rec.answer, dims:rec.dims, score:rec.score, feedback:rec.feedback, tip:rec.tip, by:rec.by}); }
  catch(e){ console.warn('push practice',e); }
}
```
- [ ] **Step 2:** Call `syncPush()` inside `save()` (fire-and-forget) and `pushPractice()` inside `grade()` after unshift.
- [ ] **Step 3:** On login, pull remote → merge into `S` (remote wins for `done`/`bounty` if larger; practices merged by timestamp), then `renderHome()`.
```js
async function pullRemote(){ if(!BACKEND||!AUTH) return;
  const {data:pg}=await sb.from('progress').select('*').eq('user_id',AUTH.id).maybeSingle();
  if(pg){ S.done=[...new Set([...(S.done||[]),...(pg.done||[])])];
    S.bounty=Math.max(S.bounty||0,pg.bounty||0); S.streak=Math.max(S.streak||0,pg.streak||0);
    S.last=pg.last_date||S.last; S.graded=Object.assign({},S.graded,pg.graded||{}); S.scen=Object.assign({},S.scen,pg.scen||{}); save(); }
  const {data:pr}=await sb.from('practices').select('*').eq('user_id',AUTH.id).order('created_at',{ascending:false}).limit(500);
  if(pr){ pr.forEach(r=>{ S.history[r.lesson_n]=S.history[r.lesson_n]||[];
    if(!S.history[r.lesson_n].some(h=>Math.abs((h.ts||0)-new Date(r.created_at).getTime())<2000 && h.score===r.score))
      S.history[r.lesson_n].push({ts:new Date(r.created_at).getTime(),scenario:r.scenario,answer:r.answer,dims:r.dims,score:r.score,feedback:r.feedback,tip:r.tip,by:r.by}); });
    Object.keys(S.history).forEach(k=>S.history[k].sort((a,b)=>b.ts-a.ts)); save(); }
}
```
- [ ] **Step 4:** Verify with Puppeteer local mode (BACKEND=false): all sync functions are no-ops, app behaves exactly as before. Commit.

---

### Task 3: EQ Assessment quiz (24 items) + scoring

**Files:** Modify `index.html` (new `#quiz` view + nav + logic).

- [ ] **Step 1:** Add `QUIZ` data (24 items, per spec §7) with `{id, pillar, text, rev}`.
- [ ] **Step 2:** Add scoring:
```js
function scoreQuiz(ans){ // ans: {q1:1..5,...}
  const P={aware:[],real:[],choice:[],empath:[]};
  QUIZ.forEach(q=>{ let v=+ans[q.id]||0; if(q.rev) v=6-v; if(v) P[q.pillar].push(v); });
  const norm=a=>a.length?Math.round((a.reduce((x,y)=>x+y,0)-a.length)/(a.length*4)*100):0;
  const s={aware:norm(P.aware),real:norm(P.real),choice:norm(P.choice),empath:norm(P.empath)};
  s.total=Math.round((s.aware+s.real+s.choice+s.empath)/4);
  s.band=eqBand(s.total); return s;
}
function eqBand(t){ return t>=80?"Thuyền Trưởng Cảm Xúc":t>=60?"Hoa Tiêu Cảm Xúc":t>=40?"Thủy Thủ Tập Sự":"Tân Binh Cảm Xúc"; }
```
- [ ] **Step 3:** Quiz UI: one-question-at-a-time or scrollable list of 24 with 5-point selector; progress; "Xem kết quả" button → result screen (basic: total + band + 1 line). Store latest to `S.quiz`.
- [ ] **Step 4:** Detailed report (radar of 4 pillars + strengths/weaknesses + suggested island) — shown if `!BACKEND` (open) OR signed-in; else show "Đăng ký miễn phí để xem báo cáo chi tiết" CTA.
- [ ] **Step 5:** Persist to Supabase `assessments` when signed in (and localStorage always). On first app open with no quiz + no progress, route to quiz.
- [ ] **Step 6:** Puppeteer: fill 24 answers → verify total/band computed, radar renders, report gate logic (open in local mode). Commit.

---

### Task 4: Auth modal (email OTP + Google) + session wiring

**Files:** Modify `index.html`.

- [ ] **Step 1:** Auth modal: email input → `sb.auth.signInWithOtp({email})` (magic link/OTP), plus `sb.auth.signInWithOAuth({provider:'google'})`. Sign-out button.
- [ ] **Step 2:** On load (if BACKEND): `sb.auth.getSession()` + `onAuthStateChange` → set `AUTH`, upsert `profiles` row, call `pullRemote()`, update header (show email / login button).
- [ ] **Step 3:** One-time migration flag: when AUTH set and `!localStorage.eqgym_migrated`, `syncPush()` current local data up, set flag.
- [ ] **Step 4:** In local mode (no config) the auth UI shows a friendly "Backend chưa cấu hình" note and stays hidden from gating. Verify no errors when BACKEND=false. Commit.

---

### Task 5: Freemium gating (Đảo 0 free, 1–29 premium)

**Files:** Modify `index.html`.

- [ ] **Step 1:** Add `function isPremium(){ return !BACKEND || (AUTH && AUTH.premium_until && new Date(AUTH.premium_until)>new Date()); }` — **local mode = open** so live app never breaks pre-backend.
- [ ] **Step 2:** In `unlocked(n)`: island 0 always; islands ≥1 require `isPremium()` in addition to sequential unlock. Locked islands show 🔒 + tap → Premium CTA modal (price 999k, benefits, "Nâng cấp" placeholder button that, in Phase 2, opens payment).
- [ ] **Step 3:** Gate AI-heavy actions similarly (grade/genScenario/chat) behind `isPremium()` when BACKEND; local mode unaffected.
- [ ] **Step 4:** Puppeteer: with BACKEND mocked true + no premium → island 1 locked, CTA shows; with premium → unlocked. Commit.

---

### Task 6: `supabase/schema.sql` + `docs/SETUP-SUPABASE.md`

**Files:** Create both.

- [ ] **Step 1:** `schema.sql`: tables `profiles, assessments, progress, practices, payments, book_claims` per spec §4, with RLS enabled and policies (owner-only rows; admin read payments). Include a trigger to auto-create `profiles` on signup and generate `pay_code`.
- [ ] **Step 2:** `SETUP-SUPABASE.md`: (1) create project, (2) run schema.sql in SQL editor, (3) enable Email + Google auth, (4) copy Project URL + anon key into `index.html` config, (5) set your own account role='admin'. Screens/exact clicks.
- [ ] **Step 3:** Commit.

---

### Task 7: Deploy + verify live

- [ ] **Step 1:** `node --check` on extracted JS; run full Puppeteer suite (local mode) — 0 errors.
- [ ] **Step 2:** Commit + push `main`; poll GitHub Pages until new markers live.
- [ ] **Step 3:** Report to owner: what's live (quiz + new UI in local mode), and the 4 setup steps to flip on backend + gating.

---

## Phase 2 & 3 (code delivered, activated after Supabase + bank info)

Built as gated code + docs, tested client-side only (need live Supabase to fully verify):
- **Payment (QR duyệt tay):** Premium CTA → VietQR (needs bank info) + upload proof → `payments` pending; **Admin view** (role=admin) to approve → set `premium_until`. Edge Function `approve-payment`.
- **AI proxy:** Edge Function `ai` proxying Gemini with owner key (secret) + per-user rate limit; client calls it when signed-in Premium instead of personal key.
- **Community + book:** Premium-gated community link; `book_claims` with 50-seat counter + address capture + admin fulfillment list.

Delivered in follow-up commits after Phase 1 is green; owner setup for these documented in `SETUP-SUPABASE.md`.
