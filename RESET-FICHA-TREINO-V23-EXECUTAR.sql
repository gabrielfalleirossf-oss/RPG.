-- Execute uma única vez no SQL Editor do Supabase.
-- Permite ao próprio jogador restaurar somente sua ficha da campanha Testes.

create or replace function public.resetar_ficha_treino(alvo_personagem uuid)
returns public.personagens
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.personagens;
  energia_inicial integer;
begin
  select * into p
  from public.personagens
  where id=alvo_personagem
    and usuario_id=auth.uid()
    and campanha='Testes'
  for update;

  if not found then
    raise exception 'Esta ficha não pertence ao jogador ou não está na campanha Testes.';
  end if;

  energia_inicial := greatest(0, case p.origem
    when 'Nerd' then 2
    when 'Lutador' then -4
    when 'Bodybuilder' then -3
    else 0
  end) * 5;

  update public.personagens
  set nivel=0,
      experiencia=0,
      agilidade=0,
      forca=0,
      apt_magica=0,
      presenca=0,
      resistencia=0,
      pontos_atributo=5,
      vida_atual=15,
      vida_max=15,
      energia_atual=energia_inicial,
      energia_max=energia_inicial,
      sanidade_atual=100,
      sanidade_max=100,
      defesa=10
  where id=p.id
  returning * into p;

  return p;
end;
$$;

revoke all on function public.resetar_ficha_treino(uuid) from public;
grant execute on function public.resetar_ficha_treino(uuid) to authenticated;
