-- Execute uma única vez no SQL Editor do Supabase.
-- Adiciona habilidades e inventário às fichas.

create or replace function public.usuario_e_mestre(alvo_rpg public.rpg_nome)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.membros_rpg where usuario_id=auth.uid() and rpg=alvo_rpg and perfil='mestre') $$;
revoke all on function public.usuario_e_mestre(public.rpg_nome) from public;
grant execute on function public.usuario_e_mestre(public.rpg_nome) to authenticated;

create table if not exists public.habilidades_personagem (
  id uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  descricao text not null default '',
  foto_path text,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists public.itens_personagem (
  id uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  descricao text not null default '',
  bonus text not null default '',
  foto_path text,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
create index if not exists habilidades_personagem_idx on public.habilidades_personagem(personagem_id,criado_em);
create index if not exists itens_personagem_idx on public.itens_personagem(personagem_id,criado_em);
alter table public.habilidades_personagem enable row level security;
alter table public.itens_personagem enable row level security;
grant select,insert,update,delete on public.habilidades_personagem to authenticated;
grant select,insert,update,delete on public.itens_personagem to authenticated;

drop policy if exists "membro visualiza habilidades" on public.habilidades_personagem;
create policy "membro visualiza habilidades" on public.habilidades_personagem for select to authenticated using (
 exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
);
drop policy if exists "mestre gerencia habilidades" on public.habilidades_personagem;
create policy "mestre gerencia habilidades" on public.habilidades_personagem for all to authenticated using (
 exists(select 1 from public.personagens p where p.id=personagem_id and public.usuario_e_mestre(p.rpg))
) with check (
 criado_por=auth.uid() and exists(select 1 from public.personagens p where p.id=personagem_id and public.usuario_e_mestre(p.rpg))
);

drop policy if exists "membro visualiza itens" on public.itens_personagem;
create policy "membro visualiza itens" on public.itens_personagem for select to authenticated using (
 exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
);
drop policy if exists "membro adiciona itens" on public.itens_personagem;
create policy "membro adiciona itens" on public.itens_personagem for insert to authenticated with check (
 criado_por=auth.uid() and exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
);
drop policy if exists "membro gerencia itens" on public.itens_personagem;
create policy "membro gerencia itens" on public.itens_personagem for update to authenticated using (
 exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
) with check (
 exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
);
drop policy if exists "membro remove itens" on public.itens_personagem;
create policy "membro remove itens" on public.itens_personagem for delete to authenticated using (
 exists(select 1 from public.personagens p where p.id=personagem_id and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)))
);

drop policy if exists "membro visualiza imagens da propria ficha" on storage.objects;
create policy "membro visualiza imagens da propria ficha" on storage.objects for select to authenticated using (
 bucket_id='personagens' and (
   exists(select 1 from public.habilidades_personagem h join public.personagens p on p.id=h.personagem_id where h.foto_path=name and p.usuario_id=auth.uid())
   or exists(select 1 from public.itens_personagem i join public.personagens p on p.id=i.personagem_id where i.foto_path=name and p.usuario_id=auth.uid())
 )
);
