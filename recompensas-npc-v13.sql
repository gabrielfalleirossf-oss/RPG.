-- Execute uma unica vez no SQL Editor do Supabase.
-- Cadastra drops e equipamentos com imagem, descrição e bônus.
create table if not exists public.recompensas_npc (
  id uuid primary key default gen_random_uuid(),
  npc_id uuid not null references public.npcs_monstros(id) on delete cascade,
  tipo text not null check (tipo in ('drop','equipamento')),
  nome text not null check (char_length(nome) between 1 and 100),
  descricao text not null default '',
  bonus text not null default '',
  foto_path text,
  criado_em timestamptz not null default now()
);

create index if not exists recompensas_npc_ficha_idx
on public.recompensas_npc (npc_id, criado_em);

alter table public.recompensas_npc enable row level security;
grant select, insert, update, delete on public.recompensas_npc to authenticated;

drop policy if exists "mestre gerencia recompensas de npc" on public.recompensas_npc;
create policy "mestre gerencia recompensas de npc"
on public.recompensas_npc for all to authenticated
using (
  exists (
    select 1 from public.npcs_monstros n
    where n.id = npc_id and public.usuario_e_mestre(n.rpg)
  )
)
with check (
  exists (
    select 1 from public.npcs_monstros n
    where n.id = npc_id and public.usuario_e_mestre(n.rpg)
  )
);
