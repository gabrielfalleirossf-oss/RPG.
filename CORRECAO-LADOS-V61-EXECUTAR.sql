-- Correcao V61: separa jogador e NPC mesmo quando ambos usam a conta do Mestre.
-- Execute uma vez no SQL Editor depois da V60.
begin;

create or replace function public.validar_lado_confronto_v61(c public.confrontos, lado_solicitado text)
returns text language plpgsql stable security definer set search_path='' as $$
begin
  if lado_solicitado='a' and exists(
    select 1 from public.personagens where id=c.personagem_a_id and usuario_id=auth.uid()
  ) then return 'a'; end if;

  if lado_solicitado='b' and c.oponente_tipo='personagem' and exists(
    select 1 from public.personagens where id=c.personagem_b_id and usuario_id=auth.uid()
  ) then return 'b'; end if;

  if lado_solicitado='b' and c.oponente_tipo='npc' and public.usuario_e_mestre(c.rpg)
  then return 'b'; end if;

  if lado_solicitado='mestre' and public.usuario_e_mestre(c.rpg)
  then return 'mestre'; end if;

  raise exception 'Esta conta nao pode controlar o lado solicitado.';
end $$;

create or replace function public.votar_modo_confronto_v61(
  confronto_alvo uuid, escolha text, lado_solicitado text
) returns public.confrontos language plpgsql security definer set search_path='' as $$
declare c public.confrontos; lado text;
begin
  if escolha not in ('facilitado','original') then raise exception 'Escolha invalida.'; end if;
  select * into c from public.confrontos where id=confronto_alvo and ativo for update;
  if not found then raise exception 'Confronto inativo ou inexistente.'; end if;
  lado:=public.validar_lado_confronto_v61(c,lado_solicitado);
  if lado not in ('a','b') then raise exception 'Escolha um dos combatentes para votar.'; end if;

  if lado='a' then update public.confrontos set voto_a=escolha,versao=versao+1 where id=c.id;
  else update public.confrontos set voto_b=escolha,versao=versao+1 where id=c.id; end if;

  select * into c from public.confrontos where id=c.id;
  if c.voto_a is not null and c.voto_b is not null and c.voto_a=c.voto_b then
    update public.confrontos set modo_combate=c.voto_a,fase_v60='combate',
      popup_v60=jsonb_build_object('tipo','modo','titulo','Modo definido','texto','O confronto sera disputado no modo '||c.voto_a||'.'),
      confirmacao_a=false,confirmacao_b=false,versao=versao+1
    where id=c.id returning * into c;
    insert into public.historico_confronto_v60(confronto_id,lado,tipo,titulo,detalhes)
      values(c.id,lado,'modo','Modo definido',jsonb_build_object('modo',c.modo_combate));
  end if;
  return c;
end $$;

create or replace function public.duvida_confronto_v61(
  confronto_alvo uuid, contexto text, lado_solicitado text
) returns public.confrontos language plpgsql security definer set search_path='' as $$
declare c public.confrontos; lado text;
begin
  select * into c from public.confrontos where id=confronto_alvo and ativo for update;
  if not found then raise exception 'Confronto inativo.'; end if;
  lado:=public.validar_lado_confronto_v61(c,lado_solicitado);
  update public.confrontos set pausado=true,duvida_por_lado=lado,
    duvida_contexto=left(coalesce(contexto,'Duvida durante o confronto'),300),
    popup_v60=jsonb_build_object('tipo','pausa','titulo','Confronto pausado','texto','Um combatente esta com duvida. Aguarde o Mestre.'),
    confirmacao_a=false,confirmacao_b=false,versao=versao+1
  where id=c.id returning * into c;
  insert into public.historico_confronto_v60(confronto_id,lado,tipo,titulo,detalhes)
    values(c.id,lado,'duvida','Confronto pausado',jsonb_build_object('contexto',contexto));
  return c;
end $$;

create or replace function public.confirmar_popup_confronto_v61(
  confronto_alvo uuid, lado_solicitado text
) returns public.confrontos language plpgsql security definer set search_path='' as $$
declare c public.confrontos; lado text;
begin
  select * into c from public.confrontos where id=confronto_alvo and ativo for update;
  if not found then raise exception 'Confronto inativo.'; end if;
  lado:=public.validar_lado_confronto_v61(c,lado_solicitado);
  if lado='a' then update public.confrontos set confirmacao_a=true where id=c.id;
  elsif lado='b' then update public.confrontos set confirmacao_b=true where id=c.id;
  else return c; end if;
  select * into c from public.confrontos where id=c.id;
  if c.confirmacao_a and c.confirmacao_b then
    update public.confrontos set popup_v60=null,confirmacao_a=false,confirmacao_b=false,
      versao=versao+1 where id=c.id returning * into c;
  end if;
  return c;
end $$;

grant execute on function public.votar_modo_confronto_v61(uuid,text,text) to authenticated;
grant execute on function public.duvida_confronto_v61(uuid,text,text) to authenticated;
grant execute on function public.confirmar_popup_confronto_v61(uuid,text) to authenticated;

-- Limpa somente a votacao dos confrontos ativos para permitir um novo teste.
update public.confrontos set voto_a=null,voto_b=null,modo_combate=null,
  fase_v60='votacao',popup_v60=null,confirmacao_a=false,confirmacao_b=false,
  pausado=false,duvida_por_lado=null,duvida_contexto=null,versao=versao+1
where ativo;

commit;
