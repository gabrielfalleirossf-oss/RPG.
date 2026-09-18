-- V42 — execute uma única vez no SQL Editor do Supabase.
-- 1) A mesma conta pode ser Mestre e Jogador no mesmo RPG.
-- 2) Rolagens de NPCs/Monstros entram no histórico com bônus validado no banco.

begin;

alter table public.membros_rpg drop constraint if exists membros_rpg_pkey;
alter table public.membros_rpg add primary key (usuario_id,rpg,perfil);

alter table public.rolagens_campanha
  add column if not exists npc_id uuid references public.npcs_monstros(id) on delete set null,
  add column if not exists modificador integer not null default 0;

alter table public.rolagens_campanha alter column personagem_id drop not null;

create index if not exists rolagens_campanha_npc_idx
on public.rolagens_campanha(npc_id,criado_em desc);

create or replace function public.validar_rolagem_campanha()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  p public.personagens;
  n public.npcs_monstros;
  valor integer;
begin
  if (new.personagem_id is null) = (new.npc_id is null) then
    raise exception 'Informe exatamente um personagem ou NPC/monstro.';
  end if;

  if cardinality(new.resultados) is null or cardinality(new.resultados) not between 1 and 100 then
    raise exception 'Quantidade inválida.';
  end if;

  if new.npc_id is not null then
    select * into n from public.npcs_monstros where id=new.npc_id;
    if not found or not public.usuario_e_mestre(n.rpg) then
      raise exception 'NPC/Monstro sem autorização de Mestre.';
    end if;
    new.modificador:=coalesce((n.bonus_pericias->>new.origem)::integer,0);
    new.rpg:=n.rpg;
    new.campanha:=n.campanha;
    new.personagem_nome:=n.nome;
    new.jogador_nome:='Mestre · '||n.tipo;
  else
    select * into p from public.personagens where id=new.personagem_id and usuario_id=auth.uid();
    if not found then raise exception 'Personagem sem autorização.'; end if;
    new.modificador:=case
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
      else 0 end;
    new.rpg:=p.rpg;
    new.campanha:=p.campanha;
    new.personagem_nome:=p.nome;
    select nome_exibicao into new.jogador_nome from public.membros_rpg
      where usuario_id=auth.uid() and rpg=p.rpg and perfil='jogador';
    new.jogador_nome:=coalesce(new.jogador_nome,'Jogador');
  end if;

  new.total:=new.modificador;
  new.critico:=false;
  foreach valor in array new.resultados loop
    if valor is null or valor<1 or valor>new.faces then raise exception 'Resultado inválido.'; end if;
    new.total:=new.total+valor;
    new.critico:=new.critico or valor=new.faces;
  end loop;
  new.usuario_id:=auth.uid();
  new.criado_em:=now();
  return new;
end $$;

drop trigger if exists validar_rolagem_campanha_trigger on public.rolagens_campanha;
create trigger validar_rolagem_campanha_trigger before insert on public.rolagens_campanha
for each row execute function public.validar_rolagem_campanha();

drop policy if exists "jogador registra rolagem propria" on public.rolagens_campanha;
drop policy if exists "participante registra rolagem" on public.rolagens_campanha;
create policy "participante registra rolagem" on public.rolagens_campanha
for insert to authenticated with check (
  usuario_id=auth.uid() and (
    exists(select 1 from public.personagens p where p.id=personagem_id and p.usuario_id=auth.uid())
    or exists(select 1 from public.npcs_monstros n where n.id=npc_id and public.usuario_e_mestre(n.rpg))
  )
);

commit;
