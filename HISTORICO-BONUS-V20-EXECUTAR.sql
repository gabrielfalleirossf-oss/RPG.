-- Execute uma única vez no SQL Editor do Supabase.
-- Faz o histórico do Mestre registrar e somar o bônus seguro da origem.

alter table public.rolagens_campanha
  add column if not exists modificador integer not null default 0;

create or replace function public.validar_rolagem_campanha()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  p public.personagens;
  valor integer;
begin
  select * into p
  from public.personagens
  where id=new.personagem_id and usuario_id=auth.uid();

  if not found then
    raise exception 'Personagem sem autorização.';
  end if;

  if cardinality(new.resultados) is null
     or cardinality(new.resultados) not between 1 and 100 then
    raise exception 'Quantidade inválida.';
  end if;

  new.modificador := case
    when p.origem='Nerd' and new.origem='Medicina' then 2
    when p.origem='Nerd' and new.origem='Sobrevivência' then 1
    when p.origem='Nerd' and new.origem='Percepção' then 3
    when p.origem='Nerd' and new.origem='Investigação' then 1
    when p.origem='Lutador' and new.origem='Esquiva' then 2
    when p.origem='Lutador' and new.origem='HtH' then 3
    when p.origem='Lutador' and new.origem='Bloqueio' then 2
    when p.origem='Bodybuilder' and new.origem='Bloqueio' then 3
    when p.origem='Bodybuilder' and new.origem='Vontade' then 3
    when p.origem='Bodybuilder' and new.origem='Iniciativa' then 1
    else 0
  end;

  new.total:=new.modificador;
  new.critico:=false;
  foreach valor in array new.resultados loop
    if valor is null or valor<1 or valor>new.faces then
      raise exception 'Resultado inválido.';
    end if;
    new.total:=new.total+valor;
    new.critico:=new.critico or valor=new.faces;
  end loop;

  new.usuario_id:=auth.uid();
  new.rpg:=p.rpg;
  new.campanha:=p.campanha;
  new.personagem_nome:=p.nome;
  select nome_exibicao into new.jogador_nome
  from public.membros_rpg
  where usuario_id=auth.uid() and rpg=p.rpg;
  new.jogador_nome:=coalesce(new.jogador_nome,'Jogador');
  new.criado_em:=now();
  return new;
end;
$$;

drop trigger if exists validar_rolagem_campanha_trigger on public.rolagens_campanha;
create trigger validar_rolagem_campanha_trigger
before insert on public.rolagens_campanha
for each row execute function public.validar_rolagem_campanha();

