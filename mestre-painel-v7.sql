-- Novas tabelas. Não apaga personagens ou histórico.
create table if not exists public.rolagens_campanha (
 id uuid primary key default gen_random_uuid(),
 personagem_id uuid references public.personagens(id) on delete set null,
 usuario_id uuid default auth.uid() references auth.users(id) on delete set null,
 rpg public.rpg_nome not null,
 campanha text not null,
 jogador_nome text not null,
 personagem_nome text not null,
 faces integer not null check(faces between 2 and 1000),
 resultados integer[] not null,
 total integer not null,
 origem text not null default 'Dados',
 critico boolean not null default false,
 criado_em timestamptz not null default now()
);
create index if not exists rolagens_campanha_idx on public.rolagens_campanha(rpg,campanha,criado_em desc);
create or replace function public.validar_rolagem_campanha()
returns trigger language plpgsql security definer set search_path='' as $$
declare p public.personagens; valor integer;
begin
 select * into p from public.personagens where id=new.personagem_id and usuario_id=auth.uid();
 if not found then raise exception 'Personagem sem autorização.'; end if;
 if cardinality(new.resultados) is null or cardinality(new.resultados) not between 1 and 100 then raise exception 'Quantidade inválida.'; end if;
 new.total:=0; new.critico:=false;
 foreach valor in array new.resultados loop
  if valor is null or valor<1 or valor>new.faces then raise exception 'Resultado inválido.'; end if;
  new.total:=new.total+valor;
  new.critico:=new.critico or valor=new.faces;
 end loop;
 new.usuario_id:=auth.uid();new.rpg:=p.rpg;new.campanha:=p.campanha;new.personagem_nome:=p.nome;
 select nome_exibicao into new.jogador_nome from public.membros_rpg where usuario_id=auth.uid() and rpg=p.rpg;
 new.jogador_nome:=coalesce(new.jogador_nome,'Jogador');new.criado_em:=now();
 return new;
end $$;
drop trigger if exists validar_rolagem_campanha_trigger on public.rolagens_campanha;
create trigger validar_rolagem_campanha_trigger before insert on public.rolagens_campanha for each row execute function public.validar_rolagem_campanha();
alter table public.rolagens_campanha enable row level security;
revoke all on public.rolagens_campanha from anon,authenticated;
grant select,insert on public.rolagens_campanha to authenticated;
drop policy if exists "jogador registra rolagem propria" on public.rolagens_campanha;
create policy "jogador registra rolagem propria" on public.rolagens_campanha for insert to authenticated with check (
 usuario_id=auth.uid() and exists(select 1 from public.personagens p where p.id=personagem_id and p.usuario_id=auth.uid())
);
drop policy if exists "mestre consulta historico" on public.rolagens_campanha;
create policy "mestre consulta historico" on public.rolagens_campanha for select to authenticated using(public.usuario_e_mestre(rpg));

create table if not exists public.npcs_monstros (
 id uuid primary key default gen_random_uuid(),
 rpg public.rpg_nome not null,
 campanha text not null,
 tipo text not null default 'NPC' check(tipo in ('NPC','Monstro')),
 nome text not null check(char_length(nome) between 1 and 100),
 descricao text not null default '',
 ficha_livre text not null default '',
 foto_path text,
 agilidade integer not null default 0,
 forca integer not null default 0,
 apt_magica integer not null default 0,
 presenca integer not null default 0,
 resistencia integer not null default 0,
 vida_atual integer not null default 15,
 vida_max integer not null default 15,
 energia_atual integer not null default 0,
 energia_max integer not null default 0,
 sanidade_atual integer not null default 100,
 sanidade_max integer not null default 100,
 defesa integer not null default 10,
 criado_em timestamptz not null default now()
);
create index if not exists npcs_monstros_campanha_idx on public.npcs_monstros(rpg,campanha);
alter table public.npcs_monstros enable row level security;
revoke all on public.npcs_monstros from anon,authenticated;
grant select,insert,update,delete on public.npcs_monstros to authenticated;
drop policy if exists "somente mestre gerencia npcs" on public.npcs_monstros;
create policy "somente mestre gerencia npcs" on public.npcs_monstros for all to authenticated using(public.usuario_e_mestre(rpg)) with check(public.usuario_e_mestre(rpg));
