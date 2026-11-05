-- An official arrangement cannot introduce a product outside its assigned set.
create function private.chido_check_assigned_products() returns trigger language plpgsql security definer set search_path='' as $$
declare entry jsonb;idx text;
begin
 if new.status='archived' then return new;end if;
 if tg_table_name='layouts' then
  if new.scene_state is null then return new;end if;
  if jsonb_typeof(new.scene_state)<>'object' or jsonb_typeof(new.scene_state->'items') is distinct from 'array' then raise exception 'چیدمان معتبر نیست.' using errcode='23514';end if;
  if jsonb_array_length(new.scene_state->'items')>128 then raise exception 'تعداد محصولات چیدمان بیش از حد مجاز است.' using errcode='23514';end if;
  for entry in select value from jsonb_array_elements(new.scene_state->'items') loop
   idx=entry->>'index';
   if idx is null or idx!~'^[0-9]{1,3}$' or not exists(select 1 from public.set_products sp join public.products p on p.id=sp.product_id where sp.set_id=new.set_id and p.catalog_index::text=idx and p.active) then raise exception 'محصول خارج از ست مجاز است.' using errcode='23514';end if;
  end loop;
 else
  if jsonb_typeof(new.material_map)<>'object' then raise exception 'رنگ‌بندی معتبر نیست.' using errcode='23514';end if;
  for idx in select key from jsonb_each(new.material_map) loop
   if not exists(select 1 from public.set_products sp join public.products p on p.id=sp.product_id where sp.set_id=new.set_id and p.catalog_index::text=idx and p.active) then raise exception 'محصول رنگ‌بندی خارج از ست مجاز است.' using errcode='23514';end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function private.chido_check_assigned_products() from public,anon,authenticated;
create trigger chido_layout_assigned_products before insert or update on public.layouts for each row execute function private.chido_check_assigned_products();
create trigger chido_colorway_assigned_products before insert or update on public.colorways for each row execute function private.chido_check_assigned_products();
