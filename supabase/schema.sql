-- Mi Semana · esquema de sincronización
-- Pégalo entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

create table if not exists public.records (
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  key         text        not null check (char_length(key) between 3 and 80),
  value       jsonb,
  deleted     boolean     not null default false,
  updated_at  bigint      not null,              -- hora del cambio en el dispositivo (ms); gana la más reciente
  modified_at timestamptz not null default now(), -- hora del servidor; cursor para descargar solo lo nuevo
  primary key (user_id, key)
);

create index if not exists records_user_modified on public.records (user_id, modified_at);

alter table public.records enable row level security;

-- Cada persona solo ve y modifica sus propias filas.
drop policy if exists "records: leer las mías" on public.records;
create policy "records: leer las mías" on public.records
  for select using (user_id = auth.uid());

drop policy if exists "records: crear las mías" on public.records;
create policy "records: crear las mías" on public.records
  for insert with check (user_id = auth.uid());

drop policy if exists "records: cambiar las mías" on public.records;
create policy "records: cambiar las mías" on public.records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Subida por lotes: solo se acepta un cambio más nuevo que el que ya hay (last-writer-wins).
create or replace function public.push_records(items jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.records (user_id, key, value, deleted, updated_at, modified_at)
  select auth.uid(), i->>'key', i->'value', coalesce((i->>'deleted')::boolean, false), (i->>'updated_at')::bigint, now()
  from jsonb_array_elements(items) as i
  on conflict (user_id, key) do update
    set value = excluded.value,
        deleted = excluded.deleted,
        updated_at = excluded.updated_at,
        modified_at = now()
    where public.records.updated_at < excluded.updated_at;
$$;

revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;
