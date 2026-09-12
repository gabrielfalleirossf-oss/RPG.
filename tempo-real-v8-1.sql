-- Execute uma única vez no SQL Editor do Supabase.
-- Ativa as notificações instantâneas de recados e rolagens.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='recados_mestre'
  ) then
    alter publication supabase_realtime add table public.recados_mestre;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='rolagens_campanha'
  ) then
    alter publication supabase_realtime add table public.rolagens_campanha;
  end if;
end $$;
