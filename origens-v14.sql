-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- Adiciona as origens e protege a troca nas campanhas principais.

alter table public.personagens
  add column if not exists origem text;

alter table public.personagens drop constraint if exists personagens_origem_valida;
alter table public.personagens
  add constraint personagens_origem_valida
  check (origem is null or origem in ('Nerd','Lutador','Bodybuilder'));

create or replace function public.sincronizar_valores_ficha()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_atributos integer;
  bonus_apt integer := 0;
begin
  if tg_op = 'UPDATE'
     and new.origem is distinct from old.origem
     and new.campanha <> 'Testes'
     and not public.usuario_e_mestre(new.rpg) then
    raise exception 'Na campanha principal, somente o Mestre pode alterar a origem.';
  end if;

  if new.agilidade < 0 or new.forca < 0 or new.apt_magica < 0
     or new.presenca < 0 or new.resistencia < 0 then
    raise exception 'Os atributos base não podem ser negativos.';
  end if;

  total_atributos := new.agilidade + new.forca + new.apt_magica
                   + new.presenca + new.resistencia;
  if total_atributos > 5 then
    raise exception 'O personagem possui somente 5 pontos base de atributo.';
  end if;

  new.pontos_atributo := 5 - total_atributos;
  bonus_apt := case new.origem
    when 'Nerd' then 2
    when 'Lutador' then -4
    when 'Bodybuilder' then -3
    else 0
  end;
  new.energia_max := greatest(0, new.apt_magica + bonus_apt) * 5;

  if tg_op = 'INSERT'
     or new.apt_magica is distinct from old.apt_magica
     or new.origem is distinct from old.origem then
    new.energia_atual := new.energia_max;
  else
    new.energia_atual := least(greatest(new.energia_atual, 0), new.energia_max);
  end if;

  new.vida_atual := least(greatest(new.vida_atual, 0), new.vida_max);
  new.experiencia := greatest(new.experiencia, 0);
  return new;
end;
$$;

drop trigger if exists sincronizar_valores_ficha_trigger on public.personagens;
create trigger sincronizar_valores_ficha_trigger
before insert or update on public.personagens
for each row execute function public.sincronizar_valores_ficha();

-- Recalcula a Energia Mágica de fichas já existentes.
update public.personagens
set origem = origem;

