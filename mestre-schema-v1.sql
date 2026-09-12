-- Execute uma única vez no SQL Editor do Supabase.
-- Libera leitura e edição de personagens somente para Mestres autorizados no mesmo RPG.

drop policy if exists "mestre visualiza personagens do seu rpg" on public.personagens;
create policy "mestre visualiza personagens do seu rpg"
on public.personagens
for select
to authenticated
using (
  exists (
    select 1 from public.membros_rpg membro
    where membro.usuario_id = (select auth.uid())
      and membro.rpg = personagens.rpg
      and membro.perfil = 'mestre'
  )
);

drop policy if exists "mestre atualiza personagens do seu rpg" on public.personagens;
create policy "mestre atualiza personagens do seu rpg"
on public.personagens
for update
to authenticated
using (
  exists (
    select 1 from public.membros_rpg membro
    where membro.usuario_id = (select auth.uid())
      and membro.rpg = personagens.rpg
      and membro.perfil = 'mestre'
  )
)
with check (
  exists (
    select 1 from public.membros_rpg membro
    where membro.usuario_id = (select auth.uid())
      and membro.rpg = personagens.rpg
      and membro.perfil = 'mestre'
  )
);

drop policy if exists "mestre visualiza fotos do seu rpg" on storage.objects;
create policy "mestre visualiza fotos do seu rpg"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'personagens'
  and exists (
    select 1 from public.membros_rpg membro
    where membro.usuario_id = (select auth.uid())
      and membro.perfil = 'mestre'
      and membro.rpg::text = (storage.foldername(name))[2]
  )
);
