-- Black Gym backend schema
--
-- Run this once in the Supabase SQL editor (Supabase dashboard > SQL Editor
-- > New query > paste this whole file > Run) for a new project, before the
-- backend is deployed. Safe to re-run: every statement uses
-- IF NOT EXISTS / ON CONFLICT DO NOTHING where relevant.
--
-- These tables intentionally mirror the app's existing TypeScript types
-- (expo/types/gym.ts and expo/types/rutina.ts) field-for-field, just in
-- snake_case, so the backend's store.ts / rutina-store.ts can map cleanly
-- between the two without any surprises.

create table if not exists students (
  id text primary key,
  first_name text not null,
  last_name text not null,
  phone text not null,
  created_at text not null
);

create table if not exists bookings (
  id text primary key,
  student_id text not null,
  day_of_week integer not null,
  hour integer not null
);

create table if not exists blocked_slots (
  id text primary key,
  day_of_week integer not null,
  hour integer not null,
  reason text not null
);

create table if not exists payments (
  student_id text not null,
  month text not null,
  paid boolean not null,
  method text,
  primary key (student_id, month)
);

create table if not exists pricing (
  id integer primary key,
  two_days integer not null,
  three_days integer not null,
  four_plus_days integer not null,
  mercado_pago_link text not null default ''
);

-- Seed the single pricing row if it doesn't exist yet, matching the old
-- in-memory defaults, so the app has sane numbers on first load.
insert into pricing (id, two_days, three_days, four_plus_days, mercado_pago_link)
values (1, 15000, 20000, 25000, '')
on conflict (id) do nothing;

create table if not exists rutina_exercises (
  id text primary key,
  name text not null,
  video_url text not null,
  muscle_group text not null,
  equipment text,
  difficulty text,
  notes text
);

create table if not exists rutina_templates (
  id text primary key,
  name text not null,
  gender text not null,
  level text not null
);

create table if not exists rutina_days (
  id text primary key,
  name text not null,
  day_letter text not null,
  order_num integer not null,
  template_id text,
  student_id text
);

create table if not exists rutina_day_exercises (
  id text primary key,
  day_id text not null,
  exercise_id text not null,
  sets integer not null,
  reps text not null,
  order_num integer not null
);

create table if not exists rutina_workouts (
  id text primary key,
  day_id text not null,
  date text not null,
  student_id text not null
);

create table if not exists rutina_workout_sets (
  id text primary key,
  workout_id text not null,
  exercise_id text not null,
  set_number integer not null,
  weight numeric not null,
  completed boolean not null
);

-- Row Level Security: the backend talks to Supabase with the SERVICE ROLE
-- key (set only as a secret in Render, never in the app or this repo),
-- which always bypasses RLS. Enabling RLS with no policies here means that
-- if anyone ever got hold of the public/anon key instead, they could not
-- read or write anything — belt and suspenders on top of the service key
-- already being kept secret.
alter table students enable row level security;
alter table bookings enable row level security;
alter table blocked_slots enable row level security;
alter table payments enable row level security;
alter table pricing enable row level security;
alter table rutina_exercises enable row level security;
alter table rutina_templates enable row level security;
alter table rutina_days enable row level security;
alter table rutina_day_exercises enable row level security;
alter table rutina_workouts enable row level security;
alter table rutina_workout_sets enable row level security;
