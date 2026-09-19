-- Execute uma vez no SQL Editor do Supabase antes de publicar os arquivos da V58.
-- Corrige fichas antigas em que o valor base foi gravado abaixo de zero.
-- O bônus (ou penalidade) da origem permanece aplicado na exibição da ficha.
-- A função existente continua impedindo novos valores base negativos.
begin;

with fichas_corrigidas as (
  update public.personagens
  set agilidade = greatest(coalesce(agilidade, 0), 0),
      forca = greatest(coalesce(forca, 0), 0),
      apt_magica = greatest(coalesce(apt_magica, 0), 0),
      presenca = greatest(coalesce(presenca, 0), 0),
      resistencia = greatest(coalesce(resistencia, 0), 0)
  where coalesce(agilidade, 0) < 0
     or coalesce(forca, 0) < 0
     or coalesce(apt_magica, 0) < 0
     or coalesce(presenca, 0) < 0
     or coalesce(resistencia, 0) < 0
  returning id
)
select count(*) as fichas_corrigidas from fichas_corrigidas;

commit;
