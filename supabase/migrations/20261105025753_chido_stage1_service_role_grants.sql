-- RLS bypass does not grant SQL privileges. The API's trusted server role needs explicit access.
grant usage on schema public,private to service_role;
grant select,insert,update,delete on public.companies,public.branches,public.company_memberships,public.branch_devices,public.activation_codes,public.products,public.sets,public.set_products,public.layouts,public.colorways,public.layout_requests,public.subscriptions,public.activity_events,public.live_sessions,public.live_session_scenes,public.live_session_cameras,public.live_session_guests,public.company_access_requests,public.platform_roles to service_role;
grant usage,select on sequence public.activity_events_id_seq to service_role;
notify pgrst,'reload schema';
