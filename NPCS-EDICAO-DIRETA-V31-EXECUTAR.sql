-- Execute uma única vez no SQL Editor do Supabase.
-- Guarda os bônus personalizados das perícias de cada NPC/Monstro.
alter table public.npcs_monstros
  add column if not exists bonus_pericias jsonb not null default '{}'::jsonb;

comment on column public.npcs_monstros.bonus_pericias is
  'Bônus personalizados das perícias, no formato {"Furtividade": 2, "Medicina": -1}.';
