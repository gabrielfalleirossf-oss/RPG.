-- Execute uma única vez no SQL Editor do Supabase.
-- Campos narrativos completos para NPCs e monstros.

alter table public.npcs_monstros add column if not exists nivel integer not null default 0 check(nivel>=0);
alter table public.npcs_monstros add column if not exists drops text not null default '';
alter table public.npcs_monstros add column if not exists xp_recompensa integer not null default 0 check(xp_recompensa>=0);
alter table public.npcs_monstros add column if not exists historia text not null default '';
alter table public.npcs_monstros add column if not exists personalidade text not null default '';
alter table public.npcs_monstros add column if not exists objetivos text not null default '';
alter table public.npcs_monstros add column if not exists anotacoes text not null default '';

-- Mantém registros antigos compatíveis com a nova tela.
update public.npcs_monstros
set historia=coalesce(nullif(historia,''),descricao,'')
where historia='' and descricao<>'';
