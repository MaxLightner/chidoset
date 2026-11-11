-- The company manager, not the platform admin, marks a finished model approved.
-- Edge chido-company additionally checks the linked published set before approval.
alter table public.company_requests
  drop constraint if exists company_requests_status_check;

alter table public.company_requests
  add constraint company_requests_status_check
  check (status in ('submitted','reviewing','in_progress','needs_info','completed','approved','cancelled'));
