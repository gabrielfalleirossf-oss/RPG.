-- Execute uma única vez. Mantém os personagens e dados existentes.
-- Progressão: 100 XP; +10 necessários a cada cinco níveis; +3 pontos por nível.

create or replace function public.usuario_e_mestre(alvo_rpg public.rpg_nome)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.membros_rpg where usuario_id=auth.uid() and rpg=alvo_rpg and perfil='mestre') $$;
revoke all on function public.usuario_e_mestre(public.rpg_nome) from public;
grant execute on function public.usuario_e_mestre(public.rpg_nome) to authenticated;

create or replace function public.xp_necessario(nivel_atual integer)
returns integer language sql immutable set search_path=''
as $$ select 100 + (greatest(nivel_atual,0) / 5) * 10 $$;
grant execute on function public.xp_necessario(integer) to authenticated;

create or replace function public.sincronizar_valores_ficha()
returns trigger language plpgsql set search_path='public' as $$
declare
  total_atributos integer;
  limite_atributos integer;
  custo integer;
begin
  new.nivel:=greatest(coalesce(new.nivel,0),0);
  new.experiencia:=greatest(coalesce(new.experiencia,0),0);

  custo:=public.xp_necessario(new.nivel);
  while new.experiencia >= custo loop
    new.experiencia:=new.experiencia-custo;
    new.nivel:=new.nivel+1;
    custo:=public.xp_necessario(new.nivel);
  end loop;

  if new.agilidade<0 or new.forca<0 or new.apt_magica<0 or new.presenca<0 or new.resistencia<0 then
    raise exception 'Os atributos não podem ser negativos.';
  end if;
  total_atributos:=new.agilidade+new.forca+new.apt_magica+new.presenca+new.resistencia;
  limite_atributos:=5+(new.nivel*3);
  if total_atributos>limite_atributos then
    raise exception 'A soma dos atributos ultrapassa os pontos disponíveis.';
  end if;
  new.pontos_atributo:=limite_atributos-total_atributos;
  new.energia_max:=new.apt_magica*5;
  if tg_op='INSERT' or new.apt_magica is distinct from old.apt_magica then new.energia_atual:=new.energia_max;
  else new.energia_atual:=least(greatest(new.energia_atual,0),new.energia_max); end if;
  new.vida_max:=greatest(new.vida_max,1);
  new.vida_atual:=least(greatest(new.vida_atual,0),new.vida_max);
  new.sanidade_max:=greatest(new.sanidade_max,1);
  new.sanidade_atual:=least(greatest(new.sanidade_atual,0),new.sanidade_max);
  new.atualizado_em:=now();
  return new;
end $$;

drop trigger if exists sincronizar_valores_ficha_trigger on public.personagens;
create trigger sincronizar_valores_ficha_trigger before insert or update on public.personagens
for each row execute function public.sincronizar_valores_ficha();

create table if not exists public.recados_mestre (
  id uuid primary key default gen_random_uuid(),
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rpg public.rpg_nome not null,
  campanha text not null,
  mestre_id uuid not null references auth.users(id),
  mensagem text not null check(char_length(mensagem) between 1 and 5000),
  foto_path text,
  lido boolean not null default false,
  criado_em timestamptz not null default now(),
  lido_em timestamptz
);
create index if not exists recados_jogador_idx on public.recados_mestre(usuario_id,rpg,lido,criado_em);
alter table public.recados_mestre enable row level security;
revoke all on public.recados_mestre from anon,authenticated;
grant select on public.recados_mestre to authenticated;
drop policy if exists "jogador recebe os proprios recados" on public.recados_mestre;
create policy "jogador recebe os proprios recados" on public.recados_mestre for select to authenticated
using(usuario_id=auth.uid());

create or replace function public.enviar_recado_mestre(alvo_personagem uuid, texto text, imagem_path text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.personagens; novo_id uuid;
begin
  select * into p from public.personagens where id=alvo_personagem;
  if not found or not public.usuario_e_mestre(p.rpg) then raise exception 'Ficha sem autorização de Mestre.'; end if;
  if char_length(trim(coalesce(texto,''))) not between 1 and 5000 then raise exception 'O recado precisa ter entre 1 e 5000 caracteres.'; end if;
  insert into public.recados_mestre(personagem_id,usuario_id,rpg,campanha,mestre_id,mensagem,foto_path)
  values(p.id,p.usuario_id,p.rpg,p.campanha,auth.uid(),trim(texto),imagem_path) returning id into novo_id;
  return novo_id;
end $$;
revoke all on function public.enviar_recado_mestre(uuid,text,text) from public;
grant execute on function public.enviar_recado_mestre(uuid,text,text) to authenticated;

create or replace function public.marcar_recado_lido(recado_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.recados_mestre set lido=true,lido_em=now()
 where id=recado_id and usuario_id=auth.uid();
end $$;
revoke all on function public.marcar_recado_lido(uuid) from public;
grant execute on function public.marcar_recado_lido(uuid) to authenticated;

create or replace function public.conceder_progresso_mestre(alvos uuid[], xp_adicional integer default 0, niveis_adicionais integer default 0)
returns void language plpgsql security definer set search_path='' as $$
declare ficha uuid; p public.personagens;
begin
 if cardinality(alvos) is null or cardinality(alvos) not between 1 and 100 then raise exception 'Selecione de 1 a 100 fichas.'; end if;
 if xp_adicional not between 0 and 100000 or niveis_adicionais not between 0 and 1000 or (xp_adicional=0 and niveis_adicionais=0) then raise exception 'Progressão inválida.'; end if;
 foreach ficha in array alvos loop
  select * into p from public.personagens where id=ficha for update;
  if not found or not public.usuario_e_mestre(p.rpg) then raise exception 'Ficha sem autorização de Mestre.'; end if;
  update public.personagens set experiencia=experiencia+xp_adicional,nivel=nivel+niveis_adicionais where id=ficha;
 end loop;
end $$;
revoke all on function public.conceder_progresso_mestre(uuid[],integer,integer) from public;
grant execute on function public.conceder_progresso_mestre(uuid[],integer,integer) to authenticated;

drop policy if exists "jogador visualiza imagens dos recados" on storage.objects;
create policy "jogador visualiza imagens dos recados" on storage.objects for select to authenticated using(
 bucket_id='personagens' and exists(
  select 1 from public.recados_mestre r where r.foto_path=name and r.usuario_id=auth.uid()
 )
);
