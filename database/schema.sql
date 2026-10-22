-- Jalankan di SQL Editor Supabase. Aman dijalankan ulang, tidak menghapus data.
create table if not exists public.qg_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teller','checker'))
);
create table if not exists public.qg_workspace (
  id integer primary key check (id = 1),
  revision bigint not null default 0,
  state jsonb not null
);
alter table public.qg_members enable row level security;
alter table public.qg_workspace enable row level security;
revoke all on table public.qg_members, public.qg_workspace from public, anon, authenticated;
grant select on public.qg_members to service_role;
grant select, insert, update on public.qg_workspace to service_role;

create or replace function public.qg_snapshot(p_seed jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare snapshot jsonb;
begin
  insert into public.qg_workspace(id,state) values (1,p_seed) on conflict (id) do nothing;
  select jsonb_build_object('revision',revision,'state',state) into snapshot from public.qg_workspace where id=1;
  return snapshot;
end;
$$;
create or replace function public.qg_commit(p_revision bigint,p_state jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  update public.qg_workspace set state=p_state,revision=revision+1 where id=1 and revision=p_revision;
  get diagnostics affected = row_count;
  return affected=1;
end;
$$;
revoke all on function public.qg_snapshot(jsonb) from public, anon, authenticated;
revoke all on function public.qg_commit(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.qg_snapshot(jsonb) to service_role;
grant execute on function public.qg_commit(bigint,jsonb) to service_role;

-- Setelah membuat 2 pengguna melalui Authentication > Users, beri peran:
-- insert into public.qg_members(user_id,role)
-- select id,'teller' from auth.users where email='EMAIL_TELLER_ANDA';
-- insert into public.qg_members(user_id,role)
-- select id,'checker' from auth.users where email='EMAIL_PEMERIKSA_ANDA';
