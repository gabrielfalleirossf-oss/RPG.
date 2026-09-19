-- V53 — vitória automática e escolha segura dos drops.
-- Execute depois do COMBATE-AUTOMATICO-V52-EXECUTAR.sql.
begin;

alter table public.confrontos
  add column if not exists resultado text,
  add column if not exists vencedor_personagem_id uuid references public.personagens(id) on delete set null;

create table if not exists public.recompensas_confronto (
  id uuid primary key default gen_random_uuid(),
  confronto_id uuid not null references public.confrontos(id) on delete cascade,
  item_npc_id uuid references public.itens_npc(id) on delete set null,
  personagem_id uuid not null references public.personagens(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  descricao text not null default '',
  bonus text not null default '',
  foto_path text,
  estado text not null default 'pendente' check(estado in ('pendente','aceito','recusado')),
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique(confronto_id,item_npc_id)
);

create index if not exists recompensas_confronto_jogador_idx
on public.recompensas_confronto(usuario_id,estado,criado_em);

alter table public.recompensas_confronto enable row level security;
revoke all on public.recompensas_confronto from anon,authenticated;
grant select on public.recompensas_confronto to authenticated;

drop policy if exists "jogador visualiza recompensas" on public.recompensas_confronto;
create policy "jogador visualiza recompensas" on public.recompensas_confronto
for select to authenticated using(usuario_id=auth.uid());

drop policy if exists "jogador visualiza imagens de recompensa" on storage.objects;
create policy "jogador visualiza imagens de recompensa" on storage.objects
for select to authenticated using(
  bucket_id='personagens' and exists(
    select 1 from public.recompensas_confronto r
    where r.foto_path=name and r.usuario_id=auth.uid()
  )
);

create or replace function public.finalizar_confronto_npc_derrotado()
returns trigger language plpgsql security definer set search_path='' as $$
declare c public.confrontos; p public.personagens;
begin
  if not (
    (coalesce(old.vida_atual,0)>0 and coalesce(new.vida_atual,0)<=0)
    or (coalesce(old.sanidade_atual,0)>0 and coalesce(new.sanidade_atual,0)<=0)
  ) then return new; end if;

  select * into c from public.confrontos
  where ativo and oponente_tipo='npc' and npc_b_id=new.id
  order by criado_em desc limit 1 for update;
  if not found then return new; end if;
  select * into p from public.personagens where id=c.personagem_a_id;

  insert into public.recompensas_confronto(
    confronto_id,item_npc_id,personagem_id,usuario_id,nome,descricao,bonus,foto_path
  )
  select c.id,i.id,p.id,p.usuario_id,i.nome,i.descricao,i.bonus,i.foto_path
  from public.itens_npc i where i.npc_id=new.id
  on conflict(confronto_id,item_npc_id) do nothing;

  update public.confrontos set ativo=false,encerrado_em=now(),resultado='vitoria_jogador',
    vencedor_personagem_id=p.id,
    ultimo_evento=jsonb_build_object('tipo','vitoria','vencedor_lado','a','vencedor_nome',p.nome,'derrotado_nome',new.nome),
    versao=versao+1 where id=c.id;
  return new;
end $$;

drop trigger if exists finalizar_confronto_npc_derrotado_trigger on public.npcs_monstros;
create trigger finalizar_confronto_npc_derrotado_trigger
after update of vida_atual,sanidade_atual on public.npcs_monstros
for each row execute function public.finalizar_confronto_npc_derrotado();

create or replace function public.finalizar_confronto_personagem_derrotado()
returns trigger language plpgsql security definer set search_path='' as $$
declare c public.confrontos; vencedor public.personagens;
begin
  if not (
    (coalesce(old.vida_atual,0)>0 and coalesce(new.vida_atual,0)<=0)
    or (coalesce(old.sanidade_atual,0)>0 and coalesce(new.sanidade_atual,0)<=0)
  ) then return new; end if;

  select * into c from public.confrontos
  where ativo and (personagem_a_id=new.id or personagem_b_id=new.id)
  order by criado_em desc limit 1 for update;
  if not found then return new; end if;

  if c.oponente_tipo='personagem' then
    select * into vencedor from public.personagens
    where id=case when c.personagem_a_id=new.id then c.personagem_b_id else c.personagem_a_id end;
    update public.confrontos set ativo=false,encerrado_em=now(),resultado='vitoria_jogador',
      vencedor_personagem_id=vencedor.id,
      ultimo_evento=jsonb_build_object('tipo','vitoria','vencedor_nome',vencedor.nome,'derrotado_nome',new.nome),
      versao=versao+1 where id=c.id;
  else
    update public.confrontos set ativo=false,encerrado_em=now(),resultado='vitoria_npc',
      vencedor_personagem_id=null,
      ultimo_evento=jsonb_build_object('tipo','derrota','derrotado_nome',new.nome),
      versao=versao+1 where id=c.id;
  end if;
  return new;
end $$;

drop trigger if exists finalizar_confronto_personagem_derrotado_trigger on public.personagens;
create trigger finalizar_confronto_personagem_derrotado_trigger
after update of vida_atual,sanidade_atual on public.personagens
for each row execute function public.finalizar_confronto_personagem_derrotado();

create or replace function public.decidir_recompensa_confronto(recompensa_alvo uuid, aceitar boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.recompensas_confronto; novo_item uuid;
begin
  select * into r from public.recompensas_confronto where id=recompensa_alvo for update;
  if not found or r.usuario_id<>auth.uid() then raise exception 'Recompensa sem autorização.'; end if;
  if r.estado<>'pendente' then raise exception 'Esta recompensa já foi decidida.'; end if;

  if aceitar then
    insert into public.itens_personagem(personagem_id,nome,descricao,bonus,foto_path,criado_por)
    values(r.personagem_id,r.nome,r.descricao,r.bonus,r.foto_path,auth.uid()) returning id into novo_item;
  end if;
  update public.recompensas_confronto set estado=case when aceitar then 'aceito' else 'recusado' end,
    decidido_em=now() where id=r.id;
  return jsonb_build_object('aceito',aceitar,'item_id',novo_item,'nome',r.nome,'personagem_id',r.personagem_id);
end $$;

revoke all on function public.decidir_recompensa_confronto(uuid,boolean) from public;
grant execute on function public.decidir_recompensa_confronto(uuid,boolean) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recompensas_confronto') then
    alter publication supabase_realtime add table public.recompensas_confronto;
  end if;
end $$;

commit;
