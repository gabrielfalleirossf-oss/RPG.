-- Execute uma única vez no SQL Editor do Supabase.
-- Adiciona os valores jogáveis da ficha e mantém os cálculos seguros no banco.

alter table public.personagens
  add column if not exists nivel integer not null default 0,
  add column if not exists vida_atual integer not null default 15,
  add column if not exists vida_max integer not null default 15,
  add column if not exists energia_atual integer not null default 0,
  add column if not exists energia_max integer not null default 0,
  add column if not exists experiencia integer not null default 0,
  add column if not exists agilidade integer not null default 0,
  add column if not exists forca integer not null default 0,
  add column if not exists apt_magica integer not null default 0,
  add column if not exists presenca integer not null default 0,
  add column if not exists resistencia integer not null default 0,
  add column if not exists pontos_atributo integer not null default 5;

create or replace function public.sincronizar_valores_ficha()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  total_atributos integer;
begin
  if new.agilidade < 0 or new.forca < 0 or new.apt_magica < 0
     or new.presenca < 0 or new.resistencia < 0 then
    raise exception 'Os atributos não podem ser negativos.';
  end if;

  total_atributos := new.agilidade + new.forca + new.apt_magica
                   + new.presenca + new.resistencia;
  if total_atributos > 5 then
    raise exception 'O personagem possui somente 5 pontos de atributo.';
  end if;

  new.pontos_atributo := 5 - total_atributos;
  new.energia_max := new.apt_magica * 5;

  if tg_op = 'INSERT' or new.apt_magica is distinct from old.apt_magica then
    new.energia_atual := new.energia_max;
  else
    new.energia_atual := least(greatest(new.energia_atual, 0), new.energia_max);
  end if;

  new.vida_atual := least(greatest(new.vida_atual, 0), new.vida_max);
  new.experiencia := least(greatest(new.experiencia, 0), 100);
  return new;
end;
$$;

drop trigger if exists sincronizar_valores_ficha_trigger on public.personagens;
create trigger sincronizar_valores_ficha_trigger
before insert or update on public.personagens
for each row execute function public.sincronizar_valores_ficha();

-- Normaliza personagens que já existiam antes desta atualização.
update public.personagens
set nivel = coalesce(nivel, 0),
    vida_atual = coalesce(vida_atual, 15),
    vida_max = coalesce(vida_max, 15),
    experiencia = coalesce(experiencia, 0),
    agilidade = coalesce(agilidade, 0),
    forca = coalesce(forca, 0),
    apt_magica = coalesce(apt_magica, 0),
    presenca = coalesce(presenca, 0),
    resistencia = coalesce(resistencia, 0);
