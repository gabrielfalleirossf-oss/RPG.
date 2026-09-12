-- Execute uma única vez no SQL Editor do Supabase.
-- Corrige a leitura global do Mestre sem liberar personagens de outro RPG.

create or replace function public.usuario_e_mestre(alvo_rpg public.rpg_nome)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.membros_rpg
    where usuario_id = (select auth.uid())
      and rpg = alvo_rpg
      and perfil = 'mestre'
  );
$$;

revoke all on function public.usuario_e_mestre(public.rpg_nome) from public;
grant execute on function public.usuario_e_mestre(public.rpg_nome) to authenticated;

drop policy if exists "mestre visualiza personagens do seu rpg" on public.personagens;
create policy "mestre visualiza personagens do seu rpg"
on public.personagens for select to authenticated
using (public.usuario_e_mestre(rpg));

drop policy if exists "mestre atualiza personagens do seu rpg" on public.personagens;
create policy "mestre atualiza personagens do seu rpg"
on public.personagens for update to authenticated
using (public.usuario_e_mestre(rpg))
with check (public.usuario_e_mestre(rpg));

drop policy if exists "mestre visualiza fotos do seu rpg" on storage.objects;
create policy "mestre visualiza fotos do seu rpg"
on storage.objects for select to authenticated
using (
  bucket_id = 'personagens'
  and case
    when (storage.foldername(name))[2] in ('abismo', 'marvel')
      then public.usuario_e_mestre(((storage.foldername(name))[2])::public.rpg_nome)
    else false
  end
);
