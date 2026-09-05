create type public.rpg_nome as enum ('abismo', 'marvel');
create type public.perfil_rpg as enum ('mestre', 'jogador');

create table public.membros_rpg (
    usuario_id uuid not null references auth.users(id) on delete cascade,
    rpg public.rpg_nome not null,
    perfil public.perfil_rpg not null,
    nome_exibicao text not null check (char_length(nome_exibicao) between 1 and 60),
    criado_em timestamptz not null default now(),
    primary key (usuario_id, rpg)
);

alter table public.membros_rpg enable row level security;
revoke all on table public.membros_rpg from anon;
revoke all on table public.membros_rpg from authenticated;
grant select, insert on table public.membros_rpg to authenticated;

create policy "membro le o proprio acesso"
on public.membros_rpg
for select
to authenticated
using ((select auth.uid()) = usuario_id);

create policy "usuario cadastra somente a si como jogador"
on public.membros_rpg
for insert
to authenticated
with check (
    (select auth.uid()) = usuario_id
    and perfil = 'jogador'
);

-- MESTRES: crie primeiro o usuário em Authentication > Users.
-- Depois substitua o UUID abaixo e execute UMA linha para cada RPG desejado:
-- insert into public.membros_rpg (usuario_id, rpg, perfil, nome_exibicao)
-- values ('UUID_DO_USUARIO', 'abismo', 'mestre', 'Nome do mestre');
-- insert into public.membros_rpg (usuario_id, rpg, perfil, nome_exibicao)
-- values ('UUID_DO_USUARIO', 'marvel', 'mestre', 'Nome do mestre');

-- PERSONAGENS E FOTOS
create table public.personagens (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references auth.users(id) on delete cascade,
    rpg public.rpg_nome not null,
    campanha text not null check (campanha in ('Abismo', 'Crise Multiversal', 'Testes')),
    nome text not null check (char_length(nome) between 1 and 80),
    historia text not null default '',
    personalidade text not null default '',
    objetivos text not null default '',
    anotacoes text not null default '',
    foto_path text,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index personagens_usuario_campanha_idx
on public.personagens (usuario_id, rpg, campanha, criado_em);

alter table public.personagens enable row level security;
grant select, insert, update, delete on table public.personagens to authenticated;

create policy "usuario le os proprios personagens" on public.personagens
for select to authenticated using ((select auth.uid()) = usuario_id);
create policy "usuario cria os proprios personagens" on public.personagens
for insert to authenticated with check ((select auth.uid()) = usuario_id);
create policy "usuario atualiza os proprios personagens" on public.personagens
for update to authenticated using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);
create policy "usuario apaga os proprios personagens" on public.personagens
for delete to authenticated using ((select auth.uid()) = usuario_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('personagens', 'personagens', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "usuario envia foto de personagem" on storage.objects
for insert to authenticated with check (
    bucket_id = 'personagens' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "usuario visualiza foto de personagem" on storage.objects
for select to authenticated using (
    bucket_id = 'personagens' and owner_id = (select auth.uid())::text
);
create policy "usuario atualiza foto de personagem" on storage.objects
for update to authenticated using (
    bucket_id = 'personagens' and owner_id = (select auth.uid())::text
);
create policy "usuario remove foto de personagem" on storage.objects
for delete to authenticated using (
    bucket_id = 'personagens' and owner_id = (select auth.uid())::text
);
