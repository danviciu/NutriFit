-- Run in Supabase SQL editor
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text,
  age int,
  height_cm int,
  weight_kg int,
  goal text,
  activity_level text,
  dietary_prefs text,
  allergies text,
  labs_text text,
  labs_file_name text,
  lifestyle text,
  created_at timestamptz default timezone('utc', now())
);

alter table public.profiles add column if not exists labs_text text;
alter table public.profiles add column if not exists labs_file_name text;

create table if not exists public.labs_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  mime text not null,
  storage_path text not null,
  uploaded_at timestamptz default timezone('utc', now())
);

create table if not exists public.labs_extracted (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.labs_documents(id) on delete cascade,
  extracted_json jsonb not null,
  confidence jsonb,
  extracted_at timestamptz default timezone('utc', now())
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_snapshot jsonb,
  labs_snapshot jsonb,
  plan_json jsonb not null,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null,
  page text,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz default timezone('utc', now())
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  weight_kg numeric(6,2),
  sleep_hours numeric(4,2),
  energy_level int,
  hunger_level int,
  workout_done boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, checkin_date)
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  body_markdown text not null,
  topic text not null,
  tags text[] default '{}',
  source_name text not null,
  source_url text not null unique,
  source_feed text,
  published_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  status text not null default 'published',
  read_time_min int not null default 1,
  view_count int not null default 0,
  ai_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.content_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null,
  items_count int not null default 0,
  details jsonb,
  executed_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id uuid not null references public.content_items(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(user_id, content_id)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  email_enabled boolean not null default false,
  push_enabled boolean not null default true,
  timezone text not null default 'Europe/Bucharest',
  quiet_hours_start int not null default 22,
  quiet_hours_end int not null default 7,
  weekly_digest_enabled boolean not null default true,
  weekly_digest_day int not null default 1,
  weekly_digest_hour int not null default 9,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_preferences add column if not exists weekly_digest_enabled boolean not null default true;
alter table public.notification_preferences add column if not exists weekly_digest_day int not null default 1;
alter table public.notification_preferences add column if not exists weekly_digest_hour int not null default 9;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'reminder',
  title text not null,
  message text not null,
  action_path text,
  severity text not null default 'low',
  channel text not null default 'in_app',
  status text not null default 'unread',
  dedupe_key text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz,
  dismissed_at timestamptz
);

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'pro_monthly',
  status text not null default 'active',
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  started_at timestamptz not null default timezone('utc', now()),
  current_period_start timestamptz not null default timezone('utc', now()),
  current_period_end timestamptz not null default (timezone('utc', now()) + interval '30 day'),
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_labs_documents_user on public.labs_documents(user_id, uploaded_at desc);
create index if not exists idx_labs_extracted_user on public.labs_extracted(user_id, extracted_at desc);
create index if not exists idx_plans_user on public.plans(user_id, created_at desc);
create index if not exists idx_user_events_user_time on public.user_events(user_id, occurred_at desc);
create index if not exists idx_user_events_name on public.user_events(event_name);
create index if not exists idx_daily_checkins_user_date on public.daily_checkins(user_id, checkin_date desc);
create index if not exists idx_content_items_topic_published on public.content_items(topic, published_at desc);
create index if not exists idx_content_items_status_published on public.content_items(status, published_at desc);
create index if not exists idx_content_refresh_runs_executed on public.content_refresh_runs(executed_at desc);
create index if not exists idx_content_bookmarks_user_created on public.content_bookmarks(user_id, created_at desc);
create index if not exists idx_content_bookmarks_content on public.content_bookmarks(content_id);
create unique index if not exists idx_user_notifications_user_dedupe on public.user_notifications(user_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_user_notifications_user_status_created on public.user_notifications(user_id, status, created_at desc);
create index if not exists idx_user_notifications_user_created on public.user_notifications(user_id, created_at desc);
create index if not exists idx_user_subscriptions_status_period on public.user_subscriptions(status, current_period_end desc);

alter table public.profiles enable row level security;
alter table public.labs_documents enable row level security;
alter table public.labs_extracted enable row level security;
alter table public.plans enable row level security;
alter table public.user_events enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.content_items enable row level security;
alter table public.content_refresh_runs enable row level security;
alter table public.content_bookmarks enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_notifications enable row level security;
alter table public.user_subscriptions enable row level security;

-- profiles policies
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (auth.uid() = user_id);

create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- labs_documents policies
drop policy if exists labs_documents_select_own on public.labs_documents;
drop policy if exists labs_documents_insert_own on public.labs_documents;
drop policy if exists labs_documents_update_own on public.labs_documents;

create policy labs_documents_select_own
  on public.labs_documents for select
  to authenticated
  using (auth.uid() = user_id);

create policy labs_documents_insert_own
  on public.labs_documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy labs_documents_update_own
  on public.labs_documents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- labs_extracted policies
drop policy if exists labs_extracted_select_own on public.labs_extracted;
drop policy if exists labs_extracted_insert_own on public.labs_extracted;
drop policy if exists labs_extracted_update_own on public.labs_extracted;

create policy labs_extracted_select_own
  on public.labs_extracted for select
  to authenticated
  using (auth.uid() = user_id);

create policy labs_extracted_insert_own
  on public.labs_extracted for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy labs_extracted_update_own
  on public.labs_extracted for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- plans policies
drop policy if exists plans_select_own on public.plans;
drop policy if exists plans_insert_own on public.plans;
drop policy if exists plans_update_own on public.plans;

create policy plans_select_own
  on public.plans for select
  to authenticated
  using (auth.uid() = user_id);

create policy plans_insert_own
  on public.plans for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy plans_update_own
  on public.plans for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_events policies
drop policy if exists user_events_select_own on public.user_events;
drop policy if exists user_events_insert_own on public.user_events;

create policy user_events_select_own
  on public.user_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_events_insert_own
  on public.user_events for insert
  to authenticated
  with check (auth.uid() = user_id);

-- daily_checkins policies
drop policy if exists daily_checkins_select_own on public.daily_checkins;
drop policy if exists daily_checkins_insert_own on public.daily_checkins;
drop policy if exists daily_checkins_update_own on public.daily_checkins;
drop policy if exists daily_checkins_delete_own on public.daily_checkins;

create policy daily_checkins_select_own
  on public.daily_checkins for select
  to authenticated
  using (auth.uid() = user_id);

create policy daily_checkins_insert_own
  on public.daily_checkins for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy daily_checkins_update_own
  on public.daily_checkins for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy daily_checkins_delete_own
  on public.daily_checkins for delete
  to authenticated
  using (auth.uid() = user_id);

-- content policies
drop policy if exists content_items_select_public on public.content_items;
create policy content_items_select_public
  on public.content_items for select
  to anon, authenticated
  using (status = 'published');

-- content_bookmarks policies
drop policy if exists content_bookmarks_select_own on public.content_bookmarks;
drop policy if exists content_bookmarks_insert_own on public.content_bookmarks;
drop policy if exists content_bookmarks_delete_own on public.content_bookmarks;

create policy content_bookmarks_select_own
  on public.content_bookmarks for select
  to authenticated
  using (auth.uid() = user_id);

create policy content_bookmarks_insert_own
  on public.content_bookmarks for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy content_bookmarks_delete_own
  on public.content_bookmarks for delete
  to authenticated
  using (auth.uid() = user_id);

-- notification_preferences policies
drop policy if exists notification_preferences_select_own on public.notification_preferences;
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;

create policy notification_preferences_select_own
  on public.notification_preferences for select
  to authenticated
  using (auth.uid() = user_id);

create policy notification_preferences_insert_own
  on public.notification_preferences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy notification_preferences_update_own
  on public.notification_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- user_notifications policies
drop policy if exists user_notifications_select_own on public.user_notifications;
drop policy if exists user_notifications_insert_own on public.user_notifications;
drop policy if exists user_notifications_update_own on public.user_notifications;
drop policy if exists user_notifications_delete_own on public.user_notifications;

create policy user_notifications_select_own
  on public.user_notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_notifications_insert_own
  on public.user_notifications for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy user_notifications_update_own
  on public.user_notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_notifications_delete_own
  on public.user_notifications for delete
  to authenticated
  using (auth.uid() = user_id);

-- user_subscriptions policies
drop policy if exists user_subscriptions_select_own on public.user_subscriptions;
drop policy if exists user_subscriptions_insert_own on public.user_subscriptions;
drop policy if exists user_subscriptions_update_own on public.user_subscriptions;
drop policy if exists user_subscriptions_delete_own on public.user_subscriptions;

create policy user_subscriptions_select_own
  on public.user_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_subscriptions_insert_own
  on public.user_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy user_subscriptions_update_own
  on public.user_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_subscriptions_delete_own
  on public.user_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('labs', 'labs', false)
on conflict (id) do nothing;

drop policy if exists labs_bucket_select_own on storage.objects;
drop policy if exists labs_bucket_insert_own on storage.objects;
drop policy if exists labs_bucket_update_own on storage.objects;
drop policy if exists labs_bucket_delete_own on storage.objects;

create policy labs_bucket_select_own
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'labs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy labs_bucket_insert_own
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'labs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy labs_bucket_update_own
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'labs' and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'labs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy labs_bucket_delete_own
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'labs' and (storage.foldername(name))[1] = auth.uid()::text
  );
