-- V50 — turnos, defesa e dano automático nos confrontos.
-- Execute uma vez no SQL Editor do Supabase depois dos SQLs anteriores.
begin;

alter table public.confrontos
  add column if not exists turno_lado text not null default 'a' check (turno_lado in ('a','b')),
  add column if not exists fase_turno text not null default 'ataque' check (fase_turno in ('ataque','defesa')),
  add column if not exists ataque_pericia text,
  add column if not exists ataque_resultado integer,
  add column if not exists ultimo_evento jsonb not null default '{}'::jsonb,
  add column if not exists versao bigint not null default 0;

create or replace function public.acao_confronto(confronto_alvo uuid, ator_tipo text, ator_id uuid, pericia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.confrontos; p public.personagens; n public.npcs_monstros;
  lado_ator text; lado_esperado text; tipo_real text; id_real uuid;
  bonus integer:=0; agi_ator integer:=0; forca_atacante integer:=0;
  agi_atacante integer:=0; agi_defensor integer:=0;
  dado integer; total integer; dano_dado integer; dano integer:=0; faces_dano integer:=0;
  acertou boolean:=false; motivo text; evento jsonb; nome_ator text; rolagem_id uuid;
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
    bonus:=coalesce((n.bonus_pericias->>pericia)::integer,0); agi_ator:=coalesce(n.agilidade,0);
    nome_ator:=n.nome;
  else raise exception 'Tipo de combatente inválido.'; end if;

  lado_esperado:=case when c.fase_turno='ataque' then c.turno_lado when c.turno_lado='a' then 'b' else 'a' end;
  if lado_ator<>lado_esperado then raise exception 'Ainda não é a vez deste combatente.'; end if;

  if c.fase_turno='ataque' and pericia not in ('Pontaria','HtH','Combate com haste','Esgrima') then
    raise exception 'Neste momento escolha Pontaria, HtH, Combate com haste ou Esgrima.';
  end if;
  if c.fase_turno='defesa' and pericia not in ('Esquiva','Bloqueio') then
    raise exception 'Neste momento escolha Esquiva ou Bloqueio.';
  end if;

  dado:=floor(random()*20)::integer+1; total:=dado+bonus;

  insert into public.rolagens_campanha(personagem_id,npc_id,usuario_id,rpg,campanha,jogador_nome,personagem_nome,faces,resultados,total,origem,critico,modificador)
  values(case when ator_tipo='personagem' then ator_id end,case when ator_tipo='npc' then ator_id end,auth.uid(),c.rpg,c.campanha,
    case when ator_tipo='npc' then 'Mestre · NPC/Monstro' else 'Jogador' end,nome_ator,20,array[dado],total,pericia,dado=20,bonus)
  returning id into rolagem_id;
  -- O gatilho antigo conhece os bônus de origem, mas ainda não os bônus livres.
  -- A RPC é autorizada e restaura aqui o total efetivamente usado no combate.
  update public.rolagens_campanha set modificador=bonus,total=dado+bonus where id=rolagem_id;

  if c.fase_turno='ataque' then
    evento:=jsonb_build_object('tipo','ataque','ator_lado',lado_ator,'ator_nome',nome_ator,'pericia',pericia,'dado',dado,'bonus',bonus,'total',total);
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
    dano:=greatest(0,dano_dado+forca_atacante);
    if ator_tipo='personagem' then
      update public.personagens set vida_atual=greatest(0,vida_atual-dano) where id=ator_id;
    else
      update public.npcs_monstros set vida_atual=greatest(0,vida_atual-dano) where id=ator_id;
    end if;
  end if;

  evento:=jsonb_build_object('tipo','resolucao','atacante_lado',c.turno_lado,'defensor_lado',lado_ator,'defensor_nome',nome_ator,'defesa_pericia',pericia,
    'defesa_dado',dado,'defesa_bonus',bonus,'defesa_total',total,'ataque_pericia',c.ataque_pericia,
    'ataque_total',c.ataque_resultado,'acertou',acertou,'motivo',motivo,'dano_faces',faces_dano,'dano_dado',dano_dado,
    'forca',forca_atacante,'dano',dano);
  update public.confrontos set turno_lado=lado_ator,fase_turno='ataque',ataque_pericia=null,ataque_resultado=null,
    ultimo_evento=evento,versao=versao+1 where id=c.id;
  return evento||jsonb_build_object('fase','ataque','proximo_lado',lado_ator);
end $$;

revoke all on function public.acao_confronto(uuid,text,uuid,text) from public;
grant execute on function public.acao_confronto(uuid,text,uuid,text) to authenticated;

commit;
