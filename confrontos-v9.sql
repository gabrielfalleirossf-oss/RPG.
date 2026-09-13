-- Execute uma única vez no SQL Editor do Supabase.
-- Confrontos 1x1 entre personagens, NPCs e monstros.

create table if not exists public.confrontos (
  id uuid primary key default gen_random_uuid(),
  rpg public.rpg_nome not null,
  campanha text not null,
  mestre_id uuid not null references auth.users(id) on delete cascade,
  personagem_a_id uuid not null references public.personagens(id) on delete cascade,
  oponente_tipo text not null check(oponente_tipo in ('personagem','npc')),
  personagem_b_id uuid references public.personagens(id) on delete cascade,
  npc_b_id uuid references public.npcs_monstros(id) on delete cascade,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  check(
    (oponente_tipo='personagem' and personagem_b_id is not null and npc_b_id is null)
    or (oponente_tipo='npc' and npc_b_id is not null and personagem_b_id is null)
  ),
  check(personagem_b_id is null or personagem_b_id<>personagem_a_id)
);
create index if not exists confrontos_campanha_idx on public.confrontos(rpg,campanha,ativo,criado_em desc);
create index if not exists confrontos_personagem_a_idx on public.confrontos(personagem_a_id,ativo);
create index if not exists confrontos_personagem_b_idx on public.confrontos(personagem_b_id,ativo);

alter table public.confrontos enable row level security;
revoke all on public.confrontos from anon,authenticated;
grant select on public.confrontos to authenticated;

drop policy if exists "participantes visualizam confronto" on public.confrontos;
create policy "participantes visualizam confronto" on public.confrontos for select to authenticated using(
  public.usuario_e_mestre(rpg)
  or exists(select 1 from public.personagens p where p.id=personagem_a_id and p.usuario_id=auth.uid())
  or exists(select 1 from public.personagens p where p.id=personagem_b_id and p.usuario_id=auth.uid())
);

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
  else raise exception 'Tipo de oponente inválido.';
  end if;

  update public.confrontos set ativo=false,encerrado_em=now()
  where ativo and (personagem_a_id=a.id or personagem_b_id=a.id);
  if tipo_oponente='personagem' then
    update public.confrontos set ativo=false,encerrado_em=now()
    where ativo and (personagem_a_id=b.id or personagem_b_id=b.id);
  end if;

  insert into public.confrontos(rpg,campanha,mestre_id,personagem_a_id,oponente_tipo,personagem_b_id,npc_b_id)
  values(a.rpg,a.campanha,auth.uid(),a.id,tipo_oponente,
    case when tipo_oponente='personagem' then b.id end,
    case when tipo_oponente='npc' then n.id end)
  returning id into novo_id;
  return novo_id;
end $$;
revoke all on function public.iniciar_confronto_mestre(uuid,text,uuid) from public;
grant execute on function public.iniciar_confronto_mestre(uuid,text,uuid) to authenticated;

create or replace function public.encerrar_confronto_mestre(confronto_alvo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare c public.confrontos;
begin
  select * into c from public.confrontos where id=confronto_alvo;
  if not found or not public.usuario_e_mestre(c.rpg) then raise exception 'Confronto sem autorização.'; end if;
  update public.confrontos set ativo=false,encerrado_em=now() where id=confronto_alvo;
end $$;
revoke all on function public.encerrar_confronto_mestre(uuid) from public;
grant execute on function public.encerrar_confronto_mestre(uuid) to authenticated;

create or replace function public.obter_confronto_detalhes(confronto_alvo uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.confrontos; a public.personagens; b public.personagens; n public.npcs_monstros; permitido boolean;
begin
  select * into c from public.confrontos where id=confronto_alvo;
  if not found then return null; end if;
  permitido:=public.usuario_e_mestre(c.rpg)
    or exists(select 1 from public.personagens p where p.id=c.personagem_a_id and p.usuario_id=auth.uid())
    or exists(select 1 from public.personagens p where p.id=c.personagem_b_id and p.usuario_id=auth.uid());
  if not permitido then raise exception 'Sem acesso a este confronto.'; end if;
  select * into a from public.personagens where id=c.personagem_a_id;
  if c.oponente_tipo='personagem' then select * into b from public.personagens where id=c.personagem_b_id;
  else select * into n from public.npcs_monstros where id=c.npc_b_id; end if;
  return jsonb_build_object(
    'confronto',jsonb_build_object('id',c.id,'rpg',c.rpg,'campanha',c.campanha,'ativo',c.ativo,'oponente_tipo',c.oponente_tipo,'criado_em',c.criado_em),
    'lado_a',jsonb_build_object('tipo','personagem','id',a.id,'usuario_id',a.usuario_id,'nome',a.nome,'foto_path',a.foto_path,'nivel',a.nivel,'agilidade',a.agilidade,'forca',a.forca,'apt_magica',a.apt_magica,'presenca',a.presenca,'resistencia',a.resistencia,'vida_atual',a.vida_atual,'vida_max',a.vida_max,'energia_atual',a.energia_atual,'energia_max',a.energia_max,'sanidade_atual',a.sanidade_atual,'sanidade_max',a.sanidade_max,'defesa',a.defesa),
    'lado_b',case when c.oponente_tipo='personagem' then
      jsonb_build_object('tipo','personagem','id',b.id,'usuario_id',b.usuario_id,'nome',b.nome,'foto_path',b.foto_path,'nivel',b.nivel,'agilidade',b.agilidade,'forca',b.forca,'apt_magica',b.apt_magica,'presenca',b.presenca,'resistencia',b.resistencia,'vida_atual',b.vida_atual,'vida_max',b.vida_max,'energia_atual',b.energia_atual,'energia_max',b.energia_max,'sanidade_atual',b.sanidade_atual,'sanidade_max',b.sanidade_max,'defesa',b.defesa)
    else jsonb_build_object('tipo',n.tipo,'id',n.id,'nome',n.nome,'foto_path',n.foto_path,'nivel',0,'agilidade',n.agilidade,'forca',n.forca,'apt_magica',n.apt_magica,'presenca',n.presenca,'resistencia',n.resistencia,'vida_atual',n.vida_atual,'vida_max',n.vida_max,'energia_atual',n.energia_atual,'energia_max',n.energia_max,'sanidade_atual',n.sanidade_atual,'sanidade_max',n.sanidade_max,'defesa',n.defesa) end
  );
end $$;
revoke all on function public.obter_confronto_detalhes(uuid) from public;
grant execute on function public.obter_confronto_detalhes(uuid) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='confrontos') then
    alter publication supabase_realtime add table public.confrontos;
  end if;
end $$;
