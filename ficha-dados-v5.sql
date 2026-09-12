-- Não apaga nem reinicia fichas existentes.
alter table public.personagens
  add column if not exists sanidade_atual integer not null default 100,
  add column if not exists sanidade_max integer not null default 100;

-- Retorna somente o nome cadastrado do dono da ficha autorizada.
-- Não expõe e-mails nem permite alterar a identidade do jogador.
create or replace function public.nome_jogador_da_ficha(ficha_id uuid)
returns text language sql stable security definer set search_path=''
as $$
  select m.nome_exibicao
  from public.personagens p
  join public.membros_rpg m on m.usuario_id=p.usuario_id and m.rpg=p.rpg
  where p.id=ficha_id
    and (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg))
  limit 1;
$$;
revoke all on function public.nome_jogador_da_ficha(uuid) from public;
grant execute on function public.nome_jogador_da_ficha(uuid) to authenticated;
