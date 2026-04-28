create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  ticket_number integer not null,
  customer_name text not null,
  status text not null default 'new',
  items jsonb not null,
  subtotal numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);

insert into public.app_settings (key, value)
values (
  'catalog',
  '{
    "showPrice": true,
    "menu": [],
    "milks": [],
    "syrups": [],
    "addOns": [],
    "updatedAt": ""
  }'::jsonb
)
on conflict (key) do nothing;

