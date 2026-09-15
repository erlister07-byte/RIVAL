create or replace function public.handle_match_result_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  affects_confirmed_result boolean :=
    old.result_status = 'confirmed'
    or new.result_status = 'confirmed';
  result_fields_changed boolean :=
    old.result_status is distinct from new.result_status
    or old.winner_profile_id is distinct from new.winner_profile_id
    or old.loser_profile_id is distinct from new.loser_profile_id;
begin
  if old.result_status is distinct from new.result_status then
    if new.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'completed',
        completed_at = coalesce(new.confirmed_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
      where id = new.challenge_id;
    elsif old.result_status = 'confirmed' then
      update public.challenges
      set
        status = 'accepted',
        completed_at = null,
        updated_at = timezone('utc', now())
      where id = new.challenge_id
        and status = 'completed';
    end if;
  end if;

  if affects_confirmed_result and result_fields_changed then
    perform public.recalculate_profile_stats(old.winner_profile_id);
    perform public.recalculate_profile_stats(old.loser_profile_id);
    perform public.recalculate_profile_stats(new.winner_profile_id);
    perform public.recalculate_profile_stats(new.loser_profile_id);
  end if;

  return new;
end;
$$;

revoke execute on function public.submit_match_result(uuid, uuid, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute on function public.submit_match_result(uuid, uuid, uuid, uuid, text, text)
to service_role;

revoke update on table public.matches
from public, anon, authenticated;

revoke execute on function public.confirm_match_result(uuid, uuid)
from public, anon, authenticated;

revoke execute on function public.reject_match_result(uuid, uuid)
from public, anon, authenticated;

revoke execute on function public.auto_confirm_overdue_match_results(uuid)
from public, anon, authenticated;
