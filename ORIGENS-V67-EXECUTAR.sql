-- ORIGENS V67
-- Execute uma única vez no SQL Editor do Supabase antes de publicar os arquivos.
-- Não apaga nem modifica personagens existentes.

alter table public.personagens drop constraint if exists personagens_origem_valida;
alter table public.personagens add constraint personagens_origem_valida
check (
  origem is null or origem in (
    'Nerd',
    'Lutador',
    'Bodybuilder',
    'Atleta',
    'Socorrista',
    'Delinquente',
    'Professor',
    'Funcionário da escola',
    'Ex-militar',
    'Angatubense'
  )
);

create or replace function public.sincronizar_valores_ficha()
returns trigger
language plpgsql
set search_path='public'
as $$
declare
  total_atributos integer;
  limite_atributos integer;
  custo integer;
  bonus_apt integer := 0;
  energia_calculada integer := 0;
  eh_mestre boolean := false;
begin
  eh_mestre := coalesce(public.usuario_e_mestre(new.rpg), false);

  if tg_op='UPDATE'
     and new.origem is distinct from old.origem
     and new.campanha<>'Testes'
     and not eh_mestre then
    raise exception 'Na campanha principal, somente o Mestre pode alterar a origem.';
  end if;

  new.nivel:=greatest(coalesce(new.nivel,0),0);
  new.experiencia:=greatest(coalesce(new.experiencia,0),0);
  custo:=public.xp_necessario(new.nivel);

  while new.experiencia>=custo loop
    new.experiencia:=new.experiencia-custo;
    new.nivel:=new.nivel+1;
    custo:=public.xp_necessario(new.nivel);
  end loop;

  new.agilidade:=greatest(coalesce(new.agilidade,0),0);
  new.forca:=greatest(coalesce(new.forca,0),0);
  new.apt_magica:=greatest(coalesce(new.apt_magica,0),0);
  new.presenca:=greatest(coalesce(new.presenca,0),0);
  new.resistencia:=greatest(coalesce(new.resistencia,0),0);

  total_atributos:=new.agilidade+new.forca+new.apt_magica+new.presenca+new.resistencia;
  limite_atributos:=5+(new.nivel*3);

  if total_atributos>limite_atributos and not eh_mestre then
    raise exception 'A soma dos atributos ultrapassa os pontos disponíveis para este nível.';
  end if;

  new.pontos_atributo:=greatest(0,limite_atributos-total_atributos);

  bonus_apt:=case new.origem
    when 'Nerd' then 2
    when 'Lutador' then -4
    when 'Bodybuilder' then -3
    when 'Atleta' then -2
    when 'Socorrista' then 1
    when 'Delinquente' then -2
    when 'Professor' then 2
    when 'Funcionário da escola' then -3
    when 'Ex-militar' then -3
    when 'Angatubense' then 3
    else 0
  end;

  energia_calculada:=greatest(0,new.apt_magica+bonus_apt)*5;

  if not (
    tg_op='UPDATE'
    and new.campanha='Testes'
    and new.energia_max is distinct from old.energia_max
    and new.apt_magica is not distinct from old.apt_magica
    and new.origem is not distinct from old.origem
  ) then
    new.energia_max:=energia_calculada;
  end if;

  if tg_op='INSERT'
     or new.apt_magica is distinct from old.apt_magica
     or new.origem is distinct from old.origem then
    new.energia_atual:=new.energia_max;
  else
    new.energia_atual:=least(greatest(coalesce(new.energia_atual,0),0),new.energia_max);
  end if;

  new.vida_max:=greatest(coalesce(new.vida_max,1),1);
  new.vida_atual:=least(greatest(coalesce(new.vida_atual,0),0),new.vida_max);
  new.sanidade_max:=greatest(coalesce(new.sanidade_max,1),1);
  new.sanidade_atual:=least(greatest(coalesce(new.sanidade_atual,0),0),new.sanidade_max);
  new.atualizado_em:=now();

  return new;
end;
$$;

drop trigger if exists sincronizar_valores_ficha_trigger on public.personagens;
create trigger sincronizar_valores_ficha_trigger
before insert or update on public.personagens
for each row execute function public.sincronizar_valores_ficha();
