-- RPG V54 — ações administrativas do Escudo do Mestre
-- Execute uma única vez no SQL Editor do Supabase.

create or replace function public.restaurar_recursos_campanha(
  alvo_rpg public.rpg_nome,
  alvo_campanha text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare quantidade integer;
begin
  if not public.usuario_e_mestre(alvo_rpg) then
    raise exception 'Somente o Mestre pode restaurar os jogadores.';
  end if;

  update public.personagens
     set vida_atual = vida_max,
         energia_atual = energia_max,
         sanidade_atual = sanidade_max
   where rpg = alvo_rpg
     and campanha = alvo_campanha;

  get diagnostics quantidade = row_count;
  return quantidade;
end;
$$;

create or replace function public.limpar_historico_campanha(
  alvo_rpg public.rpg_nome,
  alvo_campanha text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare quantidade integer;
begin
  if not public.usuario_e_mestre(alvo_rpg) then
    raise exception 'Somente o Mestre pode apagar o histórico de dados.';
  end if;

  delete from public.rolagens_campanha
   where rpg = alvo_rpg
     and campanha = alvo_campanha;

  get diagnostics quantidade = row_count;
  return quantidade;
end;
$$;

revoke all on function public.restaurar_recursos_campanha(public.rpg_nome,text) from public;
revoke all on function public.limpar_historico_campanha(public.rpg_nome,text) from public;
grant execute on function public.restaurar_recursos_campanha(public.rpg_nome,text) to authenticated;
grant execute on function public.limpar_historico_campanha(public.rpg_nome,text) to authenticated;
