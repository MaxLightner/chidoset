-- Product lifecycle notifications for the desktop Studio's unified request inbox.
create or replace function public.trg_chido_unified_product_events()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
  insert into public.studio_notifications(company_id,product_id,event_type,title,body)
  values(new.company_id,new.id,'new_request','درخواست جدید '||coalesce(new.product_code,''),new.name);
 elsif tg_op='UPDATE' and old.status is distinct from new.status then
  if new.status='revision_needed' then
   insert into public.studio_notifications(company_id,product_id,event_type,title,body)
   values(new.company_id,new.id,'revision_requested','نیاز به اصلاح '||coalesce(new.product_code,''),new.name);
  elsif new.status='live' then
   insert into public.studio_notifications(company_id,product_id,event_type,title,body)
   values(new.company_id,new.id,'published','مدل منتشر شد '||coalesce(new.product_code,''),new.name);
  end if;
 end if;
 return new;
end;$$;
drop trigger if exists chido_unified_product_events on public.products;
create trigger chido_unified_product_events
after insert or update of status on public.products
for each row execute function public.trg_chido_unified_product_events();