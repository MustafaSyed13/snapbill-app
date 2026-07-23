-- Snapbill database schema for Supabase (Postgres).
-- Run this once in the Supabase Dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.

-- ---------- business (one row per signed-in user) ----------
create table if not exists public.business (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text default '',
  owner_name text default '',
  type text default '',
  logo_data_url text default '',
  email text default '',
  phone text default '',
  address text default '',
  currency text default 'USD',
  tax_label text default 'Sales Tax',
  tax_rate numeric default 0,
  tax_inclusive boolean default false,
  numbering_prefix text default 'INV-',
  next_number integer default 1001,
  payment_instructions text default '',
  payment_terms integer default 14,
  default_notes text default '',
  default_terms text default '',
  accent text default '#4F46E5',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  address text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- items (products & services) ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text default '',
  description text default '',
  price numeric default 0,
  taxable boolean default true,
  unit text default 'each',
  type text default 'service',
  notes text default '',
  image_data_url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- packages ----------
create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- invoices ----------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number text default '',
  customer_id uuid references public.customers(id) on delete set null,
  customer_snapshot jsonb default '{}'::jsonb,
  issue_date timestamptz,
  due_date timestamptz,
  line_items jsonb default '[]'::jsonb,
  tax_rate numeric default 0,
  tax_inclusive boolean default false,
  discount_type text default 'none',
  discount_value numeric default 0,
  deposit_requested numeric default 0,
  currency text default 'USD',
  notes text default '',
  terms text default '',
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- payments ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null,
  method text default 'Other',
  date timestamptz default now(),
  note text default '',
  created_at timestamptz default now()
);

-- ---------- Row Level Security: every table only ever returns/accepts the signed-in user's own rows ----------
alter table public.business enable row level security;
alter table public.customers enable row level security;
alter table public.items enable row level security;
alter table public.packages enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;

drop policy if exists "own rows only" on public.business;
create policy "own rows only" on public.business for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows only" on public.customers;
create policy "own rows only" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows only" on public.items;
create policy "own rows only" on public.items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows only" on public.packages;
create policy "own rows only" on public.packages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows only" on public.invoices;
create policy "own rows only" on public.invoices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows only" on public.payments;
create policy "own rows only" on public.payments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Grants ----------
-- Enabling RLS above controls *which rows* a query can see. This section
-- controls a more basic layer: whether logged-in users are allowed to touch
-- these tables *at all*. Since "Automatically expose new tables" was left
-- off when this project was created (the safer default Supabase itself
-- recommends), these grants have to be added explicitly. Only the
-- "authenticated" role (i.e. signed-in users) gets access — the app never
-- lets a signed-out visitor read or write this data, so "anon" needs none.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.business to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select, insert, update, delete on public.packages to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.payments to authenticated;

-- ---------- Helpful indexes ----------
create index if not exists customers_user_id_idx on public.customers(user_id);
create index if not exists items_user_id_idx on public.items(user_id);
create index if not exists packages_user_id_idx on public.packages(user_id);
create index if not exists invoices_user_id_idx on public.invoices(user_id);
create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists payments_invoice_id_idx on public.payments(invoice_id);
