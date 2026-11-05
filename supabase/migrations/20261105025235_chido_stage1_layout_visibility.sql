
drop policy if exists layouts_read_company on public.layouts;
create policy layouts_read_company on public.layouts for select to authenticated using (
 exists(select 1 from public.sets s where s.id=layouts.set_id and
 (public.chido_is_platform_admin() or public.chido_is_company_admin(s.company_id) or (layouts.status='published' and public.chido_has_company_role(s.company_id))))
);
drop policy if exists colorways_read_company on public.colorways;
create policy colorways_read_company on public.colorways for select to authenticated using (
 exists(select 1 from public.sets s where s.id=colorways.set_id and
 (public.chido_is_platform_admin() or public.chido_is_company_admin(s.company_id) or (colorways.status='published' and public.chido_has_company_role(s.company_id))))
);

