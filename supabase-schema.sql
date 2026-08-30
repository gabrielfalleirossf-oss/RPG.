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
