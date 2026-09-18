-- Execute uma única vez no SQL Editor do Supabase.
-- Amplia habilidades de jogadores, NPCs e monstros sem alterar registros existentes.

alter table public.habilidades_personagem
  add column if not exists custo_magico integer,
  add column if not exists dano text,
  add column if not exists efeito text,
  add column if not exists tipo_efeito text;

alter table public.habilidades_npc
  add column if not exists custo_magico integer,
  add column if not exists dano text,
  add column if not exists efeito text,
  add column if not exists tipo_efeito text;

alter table public.habilidades_personagem
  drop constraint if exists habilidades_personagem_custo_magico_check,
  add constraint habilidades_personagem_custo_magico_check check (custo_magico is null or custo_magico >= 0),
  drop constraint if exists habilidades_personagem_tipo_efeito_check,
  add constraint habilidades_personagem_tipo_efeito_check check (tipo_efeito is null or tipo_efeito in ('benefico','malefico','misto','neutro'));

alter table public.habilidades_npc
  drop constraint if exists habilidades_npc_custo_magico_check,
  add constraint habilidades_npc_custo_magico_check check (custo_magico is null or custo_magico >= 0),
  drop constraint if exists habilidades_npc_tipo_efeito_check,
  add constraint habilidades_npc_tipo_efeito_check check (tipo_efeito is null or tipo_efeito in ('benefico','malefico','misto','neutro'));
