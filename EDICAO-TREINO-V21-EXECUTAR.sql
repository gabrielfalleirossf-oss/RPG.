-- Execute uma única vez no SQL Editor do Supabase.
-- Permite ao dono ajustar recursos apenas na campanha Testes.

create or replace function public.ajustar_recurso_treino(
  alvo_personagem uuid,
  campo_recurso text,
  variacao integer
)
returns public.personagens
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.personagens;
begin
  if variacao not in (-5,-1,1,5) then
    raise exception 'Variação inválida.';
  end if;

  select * into p from public.personagens
  where id=alvo_personagem and usuario_id=auth.uid() and campanha='Testes'
  for update;

  if not found then
    raise exception 'Esta ficha não pertence ao jogador ou não está na campanha Testes.';
  end if;

  if campo_recurso='vida' then
    update public.personagens set vida_atual=least(vida_max,greatest(0,vida_atual+variacao)) where id=p.id returning * into p;
  elsif campo_recurso='energia' then
    update public.personagens set energia_atual=least(energia_max,greatest(0,energia_atual+variacao)) where id=p.id returning * into p;
  elsif campo_recurso='sanidade' then
    update public.personagens set sanidade_atual=least(sanidade_max,greatest(0,sanidade_atual+variacao)) where id=p.id returning * into p;
  elsif campo_recurso='defesa' then
    update public.personagens set defesa=greatest(0,defesa+variacao) where id=p.id returning * into p;
  else
    raise exception 'Recurso inválido.';
  end if;

  return p;
end;
$$;

revoke all on function public.ajustar_recurso_treino(uuid,text,integer) from public;
grant execute on function public.ajustar_recurso_treino(uuid,text,integer) to authenticated;
