-- Execute uma única vez no SQL Editor do Supabase.
-- Guarda os bônus finais de perícia definidos diretamente pelo Mestre.

alter table public.personagens
  add column if not exists bonus_pericias jsonb not null default '{}'::jsonb;

comment on column public.personagens.bonus_pericias is
  'Bônus finais das perícias definidos diretamente pelo Mestre na ficha.';
