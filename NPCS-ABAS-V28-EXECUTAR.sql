-- Execute uma única vez no SQL Editor do Supabase.
-- Habilidades e inventário próprios para NPCs e Monstros.

create table if not exists public.habilidades_npc (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid not null references public.npcs_monstros(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  descricao text not null default '',
  foto_path text,
  criado_em timestamptz not null default now()
);

create table if not exists public.itens_npc (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid not null references public.npcs_monstros(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  descricao text not null default '',
  bonus text not null default '',
  foto_path text,
  criado_em timestamptz not null default now()
);

alter table public.habilidades_npc enable row level security;
alter table public.itens_npc enable row level security;
grant select,insert,update,delete on public.habilidades_npc,public.itens_npc to authenticated;

drop policy if exists "mestre gerencia habilidades npc" on public.habilidades_npc;
create policy "mestre gerencia habilidades npc" on public.habilidades_npc
for all to authenticated
using (exists(select 1 from public.npcs_monstros n where n.id=npc_id and public.usuario_e_mestre(n.rpg)))
with check (exists(select 1 from public.npcs_monstros n where n.id=npc_id and public.usuario_e_mestre(n.rpg)));

drop policy if exists "mestre gerencia itens npc" on public.itens_npc;
create policy "mestre gerencia itens npc" on public.itens_npc
for all to authenticated
using (exists(select 1 from public.npcs_monstros n where n.id=npc_id and public.usuario_e_mestre(n.rpg)))
with check (exists(select 1 from public.npcs_monstros n where n.id=npc_id and public.usuario_e_mestre(n.rpg)));
