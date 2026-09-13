-- Execute uma única vez no SQL Editor do Supabase.
-- Completa as fichas de NPCs/Monstros com nível, drops e recompensa de XP.

alter table public.npcs_monstros add column if not exists nivel integer not null default 0 check(nivel>=0);
alter table public.npcs_monstros add column if not exists drops text not null default '';
alter table public.npcs_monstros add column if not exists xp_recompensa integer not null default 0 check(xp_recompensa>=0);

comment on column public.npcs_monstros.drops is 'Um item/recompensa por linha.';
comment on column public.npcs_monstros.xp_recompensa is 'XP concedido quando o NPC ou monstro for derrotado.';
