-- Execute uma única vez no SQL Editor do Supabase.
-- Ativa atualizações instantâneas para recados, dados, habilidades, itens e progressão.

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='recados_mestre') then
    alter publication supabase_realtime add table public.recados_mestre;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rolagens_campanha') then
    alter publication supabase_realtime add table public.rolagens_campanha;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='habilidades_personagem') then
    alter publication supabase_realtime add table public.habilidades_personagem;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='itens_personagem') then
    alter publication supabase_realtime add table public.itens_personagem;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='personagens') then
    alter publication supabase_realtime add table public.personagens;
  end if;
end $$;
