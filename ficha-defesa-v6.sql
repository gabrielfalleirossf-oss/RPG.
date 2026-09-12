-- Adiciona Defesa 10 às fichas, sem apagar ou reiniciar outros valores.
alter table public.personagens
  add column if not exists defesa integer not null default 10;
