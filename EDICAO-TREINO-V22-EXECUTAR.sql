-- Execute uma única vez no SQL Editor do Supabase.
-- Ao ultrapassar o máximo em Testes, aumenta também o limite do recurso.

create or replace function public.sincronizar_valores_ficha()
returns trigger language plpgsql set search_path='public' as $$
declare
  total_atributos integer;
  limite_atributos integer;
  custo integer;
  bonus_apt integer := 0;
  energia_calculada integer := 0;
begin
  if tg_op='UPDATE' and new.origem is distinct from old.origem
     and new.campanha<>'Testes' and not public.usuario_e_mestre(new.rpg) then
    raise exception 'Na campanha principal, somente o Mestre pode alterar a origem.';
  end if;
  new.nivel:=greatest(coalesce(new.nivel,0),0);
  new.experiencia:=greatest(coalesce(new.experiencia,0),0);
  custo:=public.xp_necessario(new.nivel);
  while new.experiencia>=custo loop
    new.experiencia:=new.experiencia-custo;new.nivel:=new.nivel+1;custo:=public.xp_necessario(new.nivel);
  end loop;
  if new.agilidade<0 or new.forca<0 or new.apt_magica<0 or new.presenca<0 or new.resistencia<0 then
    raise exception 'Os atributos base não podem ser negativos.';
  end if;
  total_atributos:=new.agilidade+new.forca+new.apt_magica+new.presenca+new.resistencia;
  limite_atributos:=5+(new.nivel*3);
  if total_atributos>limite_atributos then raise exception 'A soma dos atributos ultrapassa os pontos disponíveis para este nível.'; end if;
  new.pontos_atributo:=limite_atributos-total_atributos;
  bonus_apt:=case new.origem when 'Nerd' then 2 when 'Lutador' then -4 when 'Bodybuilder' then -3 else 0 end;
  energia_calculada:=greatest(0,new.apt_magica+bonus_apt)*5;
  if not (tg_op='UPDATE' and new.campanha='Testes' and new.energia_max is distinct from old.energia_max
          and new.apt_magica is not distinct from old.apt_magica and new.origem is not distinct from old.origem) then
    new.energia_max:=energia_calculada;
  end if;
  if tg_op='INSERT' or new.apt_magica is distinct from old.apt_magica or new.origem is distinct from old.origem then
    new.energia_atual:=new.energia_max;
  else new.energia_atual:=least(greatest(new.energia_atual,0),new.energia_max); end if;
  new.vida_max:=greatest(new.vida_max,1);new.vida_atual:=least(greatest(new.vida_atual,0),new.vida_max);
  new.sanidade_max:=greatest(new.sanidade_max,1);new.sanidade_atual:=least(greatest(new.sanidade_atual,0),new.sanidade_max);
  new.atualizado_em:=now();return new;
end $$;

drop trigger if exists sincronizar_valores_ficha_trigger on public.personagens;
create trigger sincronizar_valores_ficha_trigger before insert or update on public.personagens
for each row execute function public.sincronizar_valores_ficha();

create or replace function public.ajustar_recurso_treino(alvo_personagem uuid,campo_recurso text,variacao integer)
returns public.personagens language plpgsql security definer set search_path='' as $$
declare p public.personagens; novo_valor integer;
begin
  if variacao not in (-5,-1,1,5) then raise exception 'Variação inválida.'; end if;
  select * into p from public.personagens where id=alvo_personagem and usuario_id=auth.uid() and campanha='Testes' for update;
  if not found then raise exception 'Esta ficha não pertence ao jogador ou não está na campanha Testes.'; end if;

  if campo_recurso='vida' then
    novo_valor:=greatest(0,p.vida_atual+variacao);
    update public.personagens set vida_atual=novo_valor,vida_max=greatest(vida_max,novo_valor) where id=p.id returning * into p;
  elsif campo_recurso='energia' then
    novo_valor:=greatest(0,p.energia_atual+variacao);
    update public.personagens set energia_max=greatest(energia_max,novo_valor),energia_atual=novo_valor where id=p.id returning * into p;
  elsif campo_recurso='sanidade' then
    novo_valor:=greatest(0,p.sanidade_atual+variacao);
    update public.personagens set sanidade_atual=novo_valor,sanidade_max=greatest(sanidade_max,novo_valor) where id=p.id returning * into p;
  elsif campo_recurso='defesa' then
    update public.personagens set defesa=greatest(0,defesa+variacao) where id=p.id returning * into p;
  else raise exception 'Recurso inválido.';
  end if;
  return p;
end $$;

revoke all on function public.ajustar_recurso_treino(uuid,text,integer) from public;
grant execute on function public.ajustar_recurso_treino(uuid,text,integer) to authenticated;
