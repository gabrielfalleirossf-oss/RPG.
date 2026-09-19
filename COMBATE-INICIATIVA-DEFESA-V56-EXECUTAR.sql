-- Execute após COMBATE-AUTOMATICO-V52 e VITORIA-E-DROPS-V53.
-- Novos confrontos começam por iniciativa. Confrontos ativos antigos conservam a fase atual.
begin;
alter table public.confrontos drop constraint if exists confrontos_fase_turno_check;
alter table public.confrontos add constraint confrontos_fase_turno_check
  check (fase_turno in ('iniciativa','ataque','defesa'));
alter table public.confrontos add column if not exists iniciativa_a integer,
  add column if not exists iniciativa_b integer,
  add column if not exists iniciativa_agilidade_a integer,
  add column if not exists iniciativa_agilidade_b integer,
  add column if not exists bonus_restantes integer not null default 0,
  add column if not exists bonus_retorno_lado text;

-- Substitui somente o ponto de entrada, mantendo as validações e a lógica de criação da V9.
create or replace function public.iniciar_confronto_mestre(ficha_principal uuid, tipo_oponente text, oponente_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.personagens; b public.personagens; n public.npcs_monstros; novo_id uuid;
begin
  select * into a from public.personagens where id=ficha_principal;
  if not found or not public.usuario_e_mestre(a.rpg) then raise exception 'Personagem sem autorização de Mestre.'; end if;
  if tipo_oponente='personagem' then
    select * into b from public.personagens where id=oponente_id;
    if not found or b.id=a.id or b.rpg<>a.rpg or b.campanha<>a.campanha then raise exception 'Oponente inválido para esta campanha.'; end if;
  elsif tipo_oponente='npc' then
    select * into n from public.npcs_monstros where id=oponente_id;
    if not found or n.rpg<>a.rpg or n.campanha<>a.campanha then raise exception 'NPC ou monstro inválido para esta campanha.'; end if;
  else raise exception 'Tipo de oponente inválido.'; end if;
  update public.confrontos set ativo=false,encerrado_em=now()
  where ativo and (personagem_a_id=a.id or personagem_b_id=a.id);
  if tipo_oponente='personagem' then
    update public.confrontos set ativo=false,encerrado_em=now()
    where ativo and (personagem_a_id=b.id or personagem_b_id=b.id);
  else
    update public.confrontos set ativo=false,encerrado_em=now()
    where ativo and npc_b_id=n.id;
  end if;
  insert into public.confrontos(rpg,campanha,mestre_id,personagem_a_id,oponente_tipo,personagem_b_id,npc_b_id,fase_turno,turno_lado)
  values(a.rpg,a.campanha,auth.uid(),a.id,tipo_oponente,
    case when tipo_oponente='personagem' then b.id end,
    case when tipo_oponente='npc' then n.id end,'iniciativa','a')
  returning id into novo_id;
  return novo_id;
end $$;
revoke all on function public.iniciar_confronto_mestre(uuid,text,uuid) from public;
grant execute on function public.iniciar_confronto_mestre(uuid,text,uuid) to authenticated;

create or replace function public.acao_confronto(confronto_alvo uuid, ator_tipo text, ator_id uuid, pericia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.confrontos; p public.personagens; n public.npcs_monstros;
  lado_ator text; lado_esperado text; bonus integer:=0; agi_ator integer:=0;
  forca_atacante integer:=0; agi_atacante integer:=0; agi_defensor integer:=0;
  dado integer; total integer; dano_dado integer; dano integer:=0;
  faces_dano integer:=0; defesa_antes integer:=0; absorvido integer:=0; dano_vida integer:=0;
  acertou boolean:=false; motivo text; evento jsonb; nome_ator text; rolagem_id uuid;
  proximo_lado text; proximos_bonus integer; proximo_retorno text;
  empate_agilidade boolean:=false; nome_vencedor text;
begin
  select * into c from public.confrontos where id=confronto_alvo for update;
  if not found or not c.ativo then raise exception 'Este confronto não está ativo.'; end if;
  if ator_tipo='personagem' and ator_id=c.personagem_a_id then lado_ator:='a';
  elsif ator_tipo='personagem' and ator_id=c.personagem_b_id then lado_ator:='b';
  elsif ator_tipo='npc' and ator_id=c.npc_b_id then lado_ator:='b';
  else raise exception 'Este combatente não pertence ao confronto.'; end if;
  if ator_tipo='personagem' then
    select * into p from public.personagens where id=ator_id;
    if not found or not (p.usuario_id=auth.uid() or public.usuario_e_mestre(p.rpg)) then raise exception 'Sem autorização para este combatente.'; end if;
    bonus:=case when coalesce(p.bonus_pericias,'{}'::jsonb) ? pericia
      then coalesce((p.bonus_pericias->>pericia)::integer,0)
      else case
        when p.origem='Nerd' and pericia='Medicina' then 2
        when p.origem='Nerd' and pericia='Sobrevivência' then 1
        when p.origem='Nerd' and pericia='Percepção' then 3
        when p.origem='Nerd' and pericia='Investigação' then 1
        when p.origem='Lutador' and pericia='Esquiva' then 2
        when p.origem='Lutador' and pericia='HtH' then 3
        when p.origem='Lutador' and pericia='Bloqueio' then 2
        when p.origem='Bodybuilder' and pericia='Bloqueio' then 3
        when p.origem='Bodybuilder' and pericia='Vontade' then 3
        when p.origem='Bodybuilder' and pericia='Iniciativa' then 1
        else 0 end end;
    agi_ator:=coalesce(p.agilidade,0)+case p.origem when 'Nerd' then -2 when 'Lutador' then 2 when 'Bodybuilder' then -2 else 0 end;
    nome_ator:=p.nome;
  elsif ator_tipo='npc' then
    select * into n from public.npcs_monstros where id=ator_id;
    if not found or not public.usuario_e_mestre(n.rpg) then raise exception 'Somente o Mestre controla este NPC/monstro.'; end if;
    bonus:=coalesce((n.bonus_pericias->>pericia)::integer,0);
    agi_ator:=coalesce(n.agilidade,0);nome_ator:=n.nome;
  else raise exception 'Tipo de combatente inválido.'; end if;

  lado_esperado:=case when c.fase_turno='defesa' then case when c.turno_lado='a' then 'b' else 'a' end
                       when c.fase_turno='iniciativa' then case when c.iniciativa_a is null then 'a' else 'b' end
                       else c.turno_lado end;
  if lado_ator<>lado_esperado then raise exception 'Ainda não é a vez deste combatente.'; end if;
  if c.fase_turno='iniciativa' and pericia<>'Iniciativa' then raise exception 'Role Iniciativa para começar o confronto.'; end if;
  if c.fase_turno='ataque' and pericia not in ('Pontaria','HtH','Combate com haste','Esgrima') then
    raise exception 'Neste momento escolha Pontaria, HtH, Combate com haste ou Esgrima.'; end if;
  if c.fase_turno='defesa' and pericia not in ('Esquiva','Bloqueio') then
    raise exception 'Neste momento escolha Esquiva ou Bloqueio.'; end if;

  dado:=floor(random()*20)::integer+1;total:=dado+bonus;
  insert into public.rolagens_campanha(personagem_id,npc_id,usuario_id,rpg,campanha,jogador_nome,personagem_nome,faces,resultados,total,origem,critico,modificador)
  values(case when ator_tipo='personagem' then ator_id end,case when ator_tipo='npc' then ator_id end,auth.uid(),c.rpg,c.campanha,
    case when ator_tipo='npc' then 'Mestre · NPC/Monstro' else 'Jogador' end,nome_ator,20,array[dado],total,pericia,dado=20,bonus)
  returning id into rolagem_id;
  update public.rolagens_campanha set modificador=bonus,total=dado+bonus where id=rolagem_id;

  if c.fase_turno='iniciativa' then
    if lado_ator='a' then
      evento:=jsonb_build_object('tipo','iniciativa','ator_lado','a','ator_nome',nome_ator,'dado',dado,'bonus',bonus,'total',total,'aguardando',true);
      update public.confrontos set iniciativa_a=total,iniciativa_agilidade_a=agi_ator,
        ultimo_evento=evento,versao=versao+1 where id=c.id;
      return evento;
    end if;
    empate_agilidade:=total=c.iniciativa_a and agi_ator<>c.iniciativa_agilidade_a;
    -- Empate completo: lado A começa por ser o primeiro inscrito.
    proximo_lado:=case when total>c.iniciativa_a or (total=c.iniciativa_a and agi_ator>c.iniciativa_agilidade_a) then 'b' else 'a' end;
    if proximo_lado='a' then
      select nome into nome_vencedor from public.personagens where id=c.personagem_a_id;
    else nome_vencedor:=nome_ator;end if;
    evento:=jsonb_build_object('tipo','iniciativa_resultado','ator_lado','b','dado',dado,'bonus',bonus,'total',total,
      'total_a',c.iniciativa_a,'total_b',total,'agilidade_a',c.iniciativa_agilidade_a,'agilidade_b',agi_ator,
      'vencedor_lado',proximo_lado,'vencedor_nome',nome_vencedor,'desempate_agilidade',empate_agilidade,
      'empate_completo',total=c.iniciativa_a and agi_ator=c.iniciativa_agilidade_a);
    update public.confrontos set iniciativa_b=total,iniciativa_agilidade_b=agi_ator,
      turno_lado=proximo_lado,fase_turno='ataque',ultimo_evento=evento,versao=versao+1 where id=c.id;
    return evento;
  end if;

  if c.fase_turno='ataque' then
    evento:=jsonb_build_object('tipo','ataque','ator_lado',lado_ator,'ator_nome',nome_ator,
      'pericia',pericia,'dado',dado,'bonus',bonus,'total',total,'critico',dado=20);
    update public.confrontos set fase_turno='defesa',ataque_pericia=pericia,ataque_resultado=total,
      ultimo_evento=evento,versao=versao+1 where id=c.id;
    return evento||jsonb_build_object('fase','defesa','proximo_lado',case when lado_ator='a' then 'b' else 'a' end);
  end if;

  if c.turno_lado='a' then
    select coalesce(agilidade,0)+case origem when 'Nerd' then -2 when 'Lutador' then 2 when 'Bodybuilder' then -2 else 0 end,
      coalesce(forca,0)+case origem when 'Nerd' then -2 when 'Lutador' then 1 when 'Bodybuilder' then 3 else 0 end
      into agi_atacante,forca_atacante from public.personagens where id=c.personagem_a_id;
  elsif c.oponente_tipo='personagem' then
    select coalesce(agilidade,0)+case origem when 'Nerd' then -2 when 'Lutador' then 2 when 'Bodybuilder' then -2 else 0 end,
      coalesce(forca,0)+case origem when 'Nerd' then -2 when 'Lutador' then 1 when 'Bodybuilder' then 3 else 0 end
      into agi_atacante,forca_atacante from public.personagens where id=c.personagem_b_id;
  else
    select coalesce(agilidade,0),coalesce(forca,0) into agi_atacante,forca_atacante from public.npcs_monstros where id=c.npc_b_id;
  end if;
  agi_defensor:=agi_ator;
  acertou:=total<c.ataque_resultado or (total=c.ataque_resultado and agi_atacante>agi_defensor);
  motivo:=case when total=c.ataque_resultado then
    case when agi_atacante>agi_defensor then 'Empate: atacante venceu pela Agilidade'
      when agi_defensor>agi_atacante then 'Empate: defensor venceu pela Agilidade'
      else 'Empate completo: a defesa venceu' end
    when acertou then 'Defesa menor que o ataque' else 'Defesa maior que o ataque' end;

  if acertou then
    faces_dano:=case c.ataque_pericia when 'HtH' then 4 when 'Combate com haste' then 10 else 6 end;
    dano_dado:=floor(random()*faces_dano)::integer+1;
    -- Crítico no D20 de ataque dobra apenas a Força, não o dado de dano.
    dano:=greatest(0,dano_dado+forca_atacante*case when (c.ultimo_evento->>'critico')::boolean then 2 else 1 end);
    if ator_tipo='personagem' then
      defesa_antes:=greatest(0,coalesce(p.defesa,0));
      absorvido:=least(defesa_antes,dano);dano_vida:=dano-absorvido;
      update public.personagens set defesa=greatest(0,defesa_antes-absorvido),
        vida_atual=greatest(0,vida_atual-dano_vida) where id=ator_id;
    else
      defesa_antes:=greatest(0,coalesce(n.defesa,0));
      absorvido:=least(defesa_antes,dano);dano_vida:=dano-absorvido;
      update public.npcs_monstros set defesa=greatest(0,defesa_antes-absorvido),
        vida_atual=greatest(0,vida_atual-dano_vida) where id=ator_id;
    end if;
  end if;

  -- Crítico de defesa concede dois ataques ao defensor: resposta e golpe adicional.
  if dado=20 and c.bonus_restantes=0 then
    proximo_lado:=lado_ator;proximos_bonus:=2;proximo_retorno:=c.turno_lado;
  elsif c.bonus_restantes>1 then
    proximo_lado:=c.turno_lado;proximos_bonus:=c.bonus_restantes-1;proximo_retorno:=c.bonus_retorno_lado;
  elsif c.bonus_restantes=1 then
    proximo_lado:=c.bonus_retorno_lado;proximos_bonus:=0;proximo_retorno:=null;
  else
    proximo_lado:=lado_ator;proximos_bonus:=0;proximo_retorno:=null;
  end if;
  evento:=jsonb_build_object('tipo','resolucao','atacante_lado',c.turno_lado,'defensor_lado',lado_ator,'defensor_nome',nome_ator,
    'defesa_pericia',pericia,'defesa_dado',dado,'defesa_bonus',bonus,'defesa_total',total,
    'ataque_pericia',c.ataque_pericia,'ataque_total',c.ataque_resultado,'acertou',acertou,'motivo',motivo,
    'dano_faces',faces_dano,'dano_dado',dano_dado,'forca',forca_atacante,'dano',dano,
    'defesa_antes',defesa_antes,'dano_defesa',absorvido,'dano_vida',dano_vida,
    'ataque_critico',coalesce((c.ultimo_evento->>'critico')::boolean,false),
    'defesa_critica',dado=20 and c.bonus_restantes=0,'bonus_restantes',proximos_bonus);
  -- O gatilho de morte encerra o confronto no mesmo UPDATE da Vida.
  -- Preserve o evento de vitória e o estado inativo gravados pelo gatilho.
  if not (select ativo from public.confrontos where id=c.id) then
    return evento||jsonb_build_object('fase','encerrado');
  end if;
  update public.confrontos set turno_lado=proximo_lado,fase_turno='ataque',
    ataque_pericia=null,ataque_resultado=null,bonus_restantes=proximos_bonus,
    bonus_retorno_lado=proximo_retorno,ultimo_evento=evento,versao=versao+1 where id=c.id;
  return evento||jsonb_build_object('fase','ataque','proximo_lado',proximo_lado);
end $$;
revoke all on function public.acao_confronto(uuid,text,uuid,text) from public;
grant execute on function public.acao_confronto(uuid,text,uuid,text) to authenticated;
commit;
