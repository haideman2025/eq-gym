-- ============================================================
-- EQ GYM — Supabase schema (chạy trong SQL Editor của Supabase)
-- Tạo bảng + Row Level Security (RLS) + trigger tạo profile khi đăng ký.
-- An toàn chạy lại nhiều lần (idempotent ở mức hợp lý).
-- ============================================================

-- 1) PROFILES ------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  premium_until timestamptz,
  role text not null default 'user',
  pay_code text,
  created_at timestamptz not null default now()
);

-- 2) ASSESSMENTS (kết quả trắc nghiệm EQ) --------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  answers jsonb,
  scores jsonb,
  band text,
  created_at timestamptz not null default now()
);

-- 3) PROGRESS (1 dòng / user) --------------------------------
create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  done int[] default '{}',
  bounty bigint default 0,
  streak int default 0,
  last_date text,
  graded jsonb default '{}'::jsonb,
  scen jsonb default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 4) PRACTICES (lịch sử luyện tập) ---------------------------
create table if not exists public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  lesson_n int,
  scenario text,
  answer text,
  dims jsonb,
  score int,
  feedback text,
  tip text,
  by text,
  created_at timestamptz not null default now()
);

-- 5) PAYMENTS (yêu cầu nâng cấp Premium) ---------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  amount int not null default 999000,
  code text,
  proof_url text,
  status text not null default 'pending',   -- pending | approved | rejected
  note text,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz
);

-- 6) BOOK_CLAIMS (tặng sách 50 suất) -------------------------
create table if not exists public.book_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  seq int,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper: kiểm tra admin
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Đếm số suất sách đã nhận (dùng cho giới hạn 50) — bỏ qua RLS an toàn
create or replace function public.book_seats_taken()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.book_claims;
$$;
grant execute on function public.book_seats_taken() to anon, authenticated;

-- ============================================================
-- Trigger: tự tạo profiles + pay_code khi có user mới
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, pay_code)
  values (new.id, new.email, 'EQGYM-' || upper(substr(md5(random()::text), 1, 4)))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Bật RLS
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.assessments enable row level security;
alter table public.progress    enable row level security;
alter table public.practices   enable row level security;
alter table public.payments    enable row level security;
alter table public.book_claims enable row level security;

-- PROFILES policies
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert
  with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() or public.is_admin());

-- ASSESSMENTS policies
drop policy if exists assess_rw_own on public.assessments;
create policy assess_rw_own on public.assessments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PROGRESS policies
drop policy if exists progress_rw_own on public.progress;
create policy progress_rw_own on public.progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PRACTICES policies
drop policy if exists practices_rw_own on public.practices;
create policy practices_rw_own on public.practices for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- PAYMENTS policies
drop policy if exists pay_select on public.payments;
create policy pay_select on public.payments for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists pay_insert_own on public.payments;
create policy pay_insert_own on public.payments for insert
  with check (user_id = auth.uid());
drop policy if exists pay_update_admin on public.payments;
create policy pay_update_admin on public.payments for update
  using (public.is_admin());

-- BOOK_CLAIMS policies
drop policy if exists book_select on public.book_claims;
create policy book_select on public.book_claims for select
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists book_insert_own on public.book_claims;
create policy book_insert_own on public.book_claims for insert
  with check (user_id = auth.uid());
drop policy if exists book_update_admin on public.book_claims;
create policy book_update_admin on public.book_claims for update
  using (public.is_admin());

-- ============================================================
-- (Tuỳ chọn) Đặt chính bạn làm admin sau khi đã đăng nhập lần đầu:
--   update public.profiles set role = 'admin' where email = 'ban@email.com';
-- ============================================================
