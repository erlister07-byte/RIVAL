begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

select extensions.no_plan();

-- Controlled local-only identities. The surrounding transaction is rolled back.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'loop42a-a@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'loop42a-b@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'loop42a-c@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'loop42a-d@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.profiles (
  id,
  auth_user_id,
  email,
  username,
  display_name,
  vancouver_area,
  onboarding_completed
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'loop42a-a@rival.local', 'loop42a_a', 'Loop 4.2A A', 'Downtown', true),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'loop42a-b@rival.local', 'loop42a_b', 'Loop 4.2A B', 'Kitsilano', true),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'loop42a-c@rival.local', 'loop42a_c', 'Loop 4.2A C', 'Burnaby', true),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'loop42a-d@rival.local', 'loop42a_d', 'Loop 4.2A D', 'Richmond', true);

insert into public.sports (id, slug, name, is_team_sport)
values (3, 'pickleball', 'Pickleball', false)
on conflict (id) do nothing;

insert into public.profile_stats (profile_id)
values
  ('20000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000004')
on conflict (profile_id) do nothing;

-- Build one confirmed historical match before social mutations begin.
insert into public.challenges (
  id,
  sport_id,
  challenger_profile_id,
  opponent_profile_id,
  challenge_type,
  scheduled_at,
  location_name,
  status,
  is_open
) values (
  '30000000-0000-4000-8000-000000000001',
  3,
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'casual',
  timezone('utc', now()) - interval '1 day',
  'Local Test Court',
  'pending',
  false
);

update public.challenges
set status = 'accepted', accepted_at = timezone('utc', now()) - interval '1 day'
where id = '30000000-0000-4000-8000-000000000001';

update public.matches
set
  result_status = 'pending_confirmation',
  result_outcome = 'win',
  submitted_by_profile_id = '20000000-0000-4000-8000-000000000001',
  submitted_at = timezone('utc', now()) - interval '23 hours',
  winner_profile_id = '20000000-0000-4000-8000-000000000001',
  loser_profile_id = '20000000-0000-4000-8000-000000000002',
  score_summary = '11-7'
where challenge_id = '30000000-0000-4000-8000-000000000001';

update public.matches
set
  result_status = 'confirmed',
  confirmed_by_profile_id = '20000000-0000-4000-8000-000000000002',
  confirmed_at = timezone('utc', now()) - interval '22 hours',
  result_confirmation_method = 'manual'
where challenge_id = '30000000-0000-4000-8000-000000000001';

create temporary table loop_4_2a_history_snapshot as
select
  (select count(*) from public.matches where result_status = 'confirmed') as confirmed_matches,
  (select count(*) from public.match_rating_ledger) as rating_rows,
  (select count(*) from public.profile_xp_ledger) as xp_rows,
  (select coalesce(sum(matches_played), 0) from public.profile_stats) as matches_played,
  (select coalesce(sum(xp), 0) from public.profile_stats) as total_xp;

-- Schema, constraints, indexes, RLS, and privilege surface.
select extensions.has_table('public', 'friend_relationships', 'friend_relationships exists');
select extensions.has_table('public', 'profile_blocks', 'profile_blocks exists');
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.friend_relationships'::regclass),
  'friend_relationships has RLS enabled'
);
select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.profile_blocks'::regclass),
  'profile_blocks has RLS enabled'
);
select extensions.ok(not pg_catalog.has_table_privilege('anon', 'public.friend_relationships', 'SELECT'), 'anon cannot read friendships');
select extensions.ok(not pg_catalog.has_table_privilege('authenticated', 'public.friend_relationships', 'INSERT'), 'authenticated cannot insert friendships');
select extensions.ok(not pg_catalog.has_table_privilege('authenticated', 'public.friend_relationships', 'UPDATE'), 'authenticated cannot update friendships');
select extensions.ok(not pg_catalog.has_table_privilege('authenticated', 'public.profile_blocks', 'SELECT'), 'authenticated cannot inspect block initiators');
select extensions.ok(not pg_catalog.has_table_privilege('authenticated', 'public.profile_blocks', 'INSERT'), 'authenticated cannot insert blocks');
select extensions.ok(pg_catalog.has_table_privilege('service_role', 'public.friend_relationships', 'INSERT'), 'service_role can mutate friendships');
select extensions.ok(pg_catalog.has_table_privilege('service_role', 'public.profile_blocks', 'DELETE'), 'service_role can mutate blocks');
select extensions.ok(
  not pg_catalog.has_function_privilege('authenticated', 'public.social_send_friend_request(uuid,uuid)', 'EXECUTE'),
  'authenticated cannot execute trusted friendship RPC'
);
select extensions.ok(
  not pg_catalog.has_function_privilege('authenticated', 'public.social_pair_is_blocked(uuid,uuid)', 'EXECUTE'),
  'authenticated cannot inspect arbitrary block pairs'
);
select extensions.ok(
  pg_catalog.has_function_privilege('service_role', 'public.social_send_friend_request(uuid,uuid)', 'EXECUTE'),
  'service_role can execute trusted friendship RPC'
);
select extensions.ok(
  not pg_catalog.has_function_privilege('authenticated', 'public.social_accept_challenge(uuid,uuid,boolean)', 'EXECUTE'),
  'authenticated cannot execute pair-locked challenge acceptance RPC'
);
select extensions.ok(
  pg_catalog.has_function_privilege('service_role', 'public.social_accept_challenge(uuid,uuid,boolean)', 'EXECUTE'),
  'service_role can execute pair-locked challenge acceptance RPC'
);
select extensions.ok(
  exists (select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'friend_relationships_profile_a_status_idx'),
  'profile A friendship lookup index exists'
);
select extensions.ok(
  exists (select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'friend_relationships_profile_b_status_idx'),
  'profile B friendship lookup index exists'
);
select extensions.ok(
  exists (select 1 from pg_catalog.pg_indexes where schemaname = 'public' and indexname = 'profile_blocks_blocked_blocker_idx'),
  'reverse block lookup index exists'
);

select extensions.throws_ok(
  $$insert into public.friend_relationships (profile_a_id, profile_b_id, requested_by_profile_id) values ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'self friendship is rejected'
);
select extensions.throws_ok(
  $$insert into public.friend_relationships (profile_a_id, profile_b_id, requested_by_profile_id) values ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'noncanonical friendship ordering is rejected'
);
select extensions.throws_ok(
  $$insert into public.friend_relationships (profile_a_id, profile_b_id, requested_by_profile_id) values ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003')$$,
  '23514',
  null,
  'requester outside the pair is rejected'
);
select extensions.throws_ok(
  $$insert into public.profile_blocks (blocker_profile_id, blocked_profile_id) values ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001')$$,
  '23514',
  null,
  'self block is rejected'
);

insert into public.profile_blocks (blocker_profile_id, blocked_profile_id)
values ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004');
select extensions.throws_ok(
  $$insert into public.profile_blocks (blocker_profile_id, blocked_profile_id) values ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004')$$,
  '23505',
  null,
  'duplicate directional block is rejected by the primary key'
);
delete from public.profile_blocks
where blocker_profile_id = '20000000-0000-4000-8000-000000000003'
  and blocked_profile_id = '20000000-0000-4000-8000-000000000004';

-- Friendship lifecycle and actor authorization.
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'request creation returns outgoing pending'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  'pending',
  'request persists as pending'
);
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'duplicate request is idempotent'
);
select extensions.is(
  (select count(*) from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  1::bigint,
  'duplicate request retains one canonical row'
);
select extensions.throws_ok(
  $$select public.social_respond_to_friend_request('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'accept')$$,
  'P0001',
  'Pending friend request unavailable',
  'third party cannot respond to another pair request'
);
select extensions.throws_ok(
  $$select public.social_respond_to_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'accept')$$,
  'P0001',
  'Pending friend request unavailable',
  'requester cannot accept their own request'
);
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'friends',
  'reciprocal request atomically accepts the relationship'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  'accepted',
  'reciprocal request persists one accepted friendship'
);
select extensions.is(
  public.social_remove_friendship('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'none',
  'either accepted friend can remove the friendship'
);
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'removed friendship can be requested again'
);
select extensions.throws_ok(
  $$select public.social_cancel_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Pending friend request unavailable',
  'recipient cannot cancel the requester pending request'
);
select extensions.is(
  public.social_cancel_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'none',
  'requester can cancel their pending request'
);
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'request can be recreated after cancellation'
);
select extensions.is(
  public.social_respond_to_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'decline'),
  'none',
  'intended recipient can decline'
);
select extensions.throws_ok(
  $$select public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'Friend request cooldown active',
  'declined request enforces the seven day cooldown'
);
update public.friend_relationships
set
  requested_at = timezone('utc', now()) - interval '9 days',
  responded_at = timezone('utc', now()) - interval '8 days',
  ended_at = timezone('utc', now()) - interval '8 days',
  updated_at = timezone('utc', now()) - interval '8 days'
where profile_a_id = '20000000-0000-4000-8000-000000000001'
  and profile_b_id = '20000000-0000-4000-8000-000000000002';
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'declined request can be retried after seven days'
);
select extensions.is(
  public.social_respond_to_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'accept'),
  'friends',
  'intended recipient can accept'
);
select extensions.is(
  public.social_remove_friendship('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'none',
  'the original requester can also remove an accepted friendship'
);

-- Blocking is directional in storage and mutual in enforcement.
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'outgoing_pending',
  'request exists before friendship used for block cleanup'
);
select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'friends',
  'reciprocal request accepts the friendship before blocking'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  'accepted',
  'accepted friendship exists before block cleanup'
);
insert into public.challenges (id, sport_id, challenger_profile_id, opponent_profile_id, challenge_type, scheduled_at, location_name, status, is_open)
values
  ('30000000-0000-4000-8000-000000000002', 3, '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'casual', now() + interval '1 day', 'Local Court', 'pending', false),
  ('30000000-0000-4000-8000-000000000003', 3, '20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'casual', now() + interval '1 day', 'Local Court', 'pending', false),
  ('30000000-0000-4000-8000-000000000004', 3, '20000000-0000-4000-8000-000000000001', null, 'casual', now() + interval '1 day', 'Local Court', 'pending', true);
select extensions.ok(
  public.social_block_profile('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'block creation succeeds'
);
select extensions.is(
  (select count(*) from public.challenges where id in ('30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003') and status = 'canceled' and canceled_at is not null),
  2::bigint,
  'block atomically cancels pending direct challenges in both directions'
);
select extensions.is(
  (select status::text from public.challenges where id = '30000000-0000-4000-8000-000000000001'),
  'completed',
  'block preserves completed historical challenge'
);
select extensions.is(
  (select status::text from public.challenges where id = '30000000-0000-4000-8000-000000000004'),
  'pending',
  'block preserves globally open challenge'
);
select extensions.throws_ok(
  $$insert into public.challenges (sport_id, challenger_profile_id, opponent_profile_id, challenge_type, scheduled_at, location_name, status, is_open) values (3, '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'casual', now() + interval '1 day', 'Local Court', 'pending', false)$$,
  'P0001', 'Challenge unavailable', 'database guard rejects blocked direct insert'
);
select extensions.throws_ok(
  $$update public.challenges set opponent_profile_id = '20000000-0000-4000-8000-000000000002', status = 'accepted', is_open = false, accepted_at = now() where id = '30000000-0000-4000-8000-000000000004'$$,
  'P0001', 'Challenge unavailable', 'database guard rejects blocked open join by ID'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  'removed',
  'block ends the accepted friendship'
);
select extensions.ok(
  public.social_pair_is_blocked('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'block check is mutually effective without returning initiator'
);
select extensions.throws_ok(
  $$select public.social_send_friend_request('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002')$$,
  'P0001',
  'Social interaction unavailable',
  'blocked player cannot request blocker'
);
select extensions.throws_ok(
  $$select public.social_send_friend_request('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001')$$,
  'P0001',
  'Social interaction unavailable',
  'blocker cannot request blocked player while block exists'
);
select extensions.ok(
  public.social_block_profile('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'duplicate block call is idempotent'
);
select extensions.is(
  (select count(*) from public.profile_blocks where blocker_profile_id = '20000000-0000-4000-8000-000000000002' and blocked_profile_id = '20000000-0000-4000-8000-000000000001'),
  1::bigint,
  'duplicate block retains one directional row'
);
select extensions.ok(
  not public.social_unblock_profile('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'blocked player cannot remove the blocker directional row'
);
select extensions.ok(
  public.social_pair_is_blocked('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'failed reverse unblock leaves the block effective'
);
select extensions.ok(
  public.social_unblock_profile('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001'),
  'blocker can remove their own directional block'
);
select extensions.ok(
  not public.social_pair_is_blocked('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
  'unblock clears mutual enforcement when no reverse block exists'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000001' and profile_b_id = '20000000-0000-4000-8000-000000000002'),
  'removed',
  'unblock does not restore friendship or request'
);

select extensions.is(
  public.social_send_friend_request('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004'),
  'outgoing_pending',
  'separate pending request exists before block cleanup'
);
select extensions.ok(
  public.social_block_profile('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003'),
  'recipient can block a pending requester'
);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000003' and profile_b_id = '20000000-0000-4000-8000-000000000004'),
  'removed',
  'block ends the pending request'
);
select extensions.ok(
  public.social_unblock_profile('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003'),
  'pending-request blocker can cleanly unblock'
);

-- Simultaneous reciprocal requests and request-vs-block use independent DB
-- sessions and committed, test-only identities separate from the transaction
-- fixtures above.
select extensions.dblink_connect(
  'loop42a_setup',
  format(
    'hostaddr=%s port=%s dbname=%I user=postgres password=postgres',
    inet_server_addr(),
    current_setting('port'),
    current_database()
  )
);
select extensions.dblink_exec('loop42a_setup', $setup$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'loop42a-e@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'loop42a-f@rival.local', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

  insert into public.profiles (
    id, auth_user_id, email, username, display_name, vancouver_area, onboarding_completed
  ) values
    ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000005', 'loop42a-e@rival.local', 'loop42a_e', 'Loop 4.2A E', 'Surrey', true),
    ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000006', 'loop42a-f@rival.local', 'loop42a_f', 'Loop 4.2A F', 'New Westminster', true);
$setup$);

select extensions.dblink_connect(
  'loop42a_request_a',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_connect(
  'loop42a_request_b',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_send_query(
  'loop42a_request_a',
  $$select public.social_send_friend_request('10000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006')$$
);
select extensions.dblink_send_query(
  'loop42a_request_b',
  $$select public.social_send_friend_request('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005')$$
);
select * from extensions.dblink_get_result('loop42a_request_a') as result(state text);
select * from extensions.dblink_get_result('loop42a_request_b') as result(state text);
select extensions.is(
  (select status::text from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000005' and profile_b_id = '20000000-0000-4000-8000-000000000006'),
  'accepted',
  'simultaneous reciprocal requests converge to one accepted friendship'
);
select extensions.is(
  (select count(*) from public.friend_relationships where profile_a_id = '20000000-0000-4000-8000-000000000005' and profile_b_id = '20000000-0000-4000-8000-000000000006'),
  1::bigint,
  'simultaneous requests retain one canonical pair row'
);
select extensions.dblink_disconnect('loop42a_request_a');
select extensions.dblink_disconnect('loop42a_request_b');

select extensions.dblink_exec('loop42a_setup', $setup$
  delete from public.friend_relationships
  where profile_a_id = '20000000-0000-4000-8000-000000000005'
    and profile_b_id = '20000000-0000-4000-8000-000000000006';

  create or replace function public.loop_4_2a_slow_friend_request()
  returns text
  language plpgsql
  security invoker
  set search_path = ''
  as $function$
  begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        '20000000-0000-4000-8000-000000000005:20000000-0000-4000-8000-000000000006',
        0
      )
    );
    perform pg_catalog.pg_sleep(0.2);
    return public.social_send_friend_request(
      '10000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000006'
    );
  end;
  $function$;
$setup$);

select extensions.dblink_connect(
  'loop42a_race_request',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_connect(
  'loop42a_race_block',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_send_query(
  'loop42a_race_request',
  $$select public.loop_4_2a_slow_friend_request()$$
);
select pg_catalog.pg_sleep(0.05);
select extensions.dblink_send_query(
  'loop42a_race_block',
  $$select public.social_block_profile('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005')$$
);
select * from extensions.dblink_get_result('loop42a_race_request') as result(state text);
select * from extensions.dblink_get_result('loop42a_race_block') as result(blocked boolean);
select extensions.ok(
  public.social_pair_is_blocked('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006'),
  'block-vs-request race leaves the pair blocked'
);
select extensions.ok(
  not exists (
    select 1 from public.friend_relationships
    where profile_a_id = '20000000-0000-4000-8000-000000000005'
      and profile_b_id = '20000000-0000-4000-8000-000000000006'
      and status in ('pending', 'accepted')
  ),
  'block-vs-request race leaves no active friendship state'
);
select extensions.dblink_disconnect('loop42a_race_request');
select extensions.dblink_disconnect('loop42a_race_block');

-- Challenge writes and blocks must serialize on the same canonical pair lock.
select extensions.dblink_exec('loop42a_setup', $setup$
  delete from public.profile_blocks where blocker_profile_id = '20000000-0000-4000-8000-000000000006' and blocked_profile_id = '20000000-0000-4000-8000-000000000005';
  create function public.loop_4_2a_race_challenge(slow boolean)
  returns text language plpgsql security invoker set search_path = '' as $function$
  begin
    if slow then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('20000000-0000-4000-8000-000000000005:20000000-0000-4000-8000-000000000006', 0));
      perform pg_catalog.pg_sleep(0.2);
    end if;
    insert into public.challenges (id, sport_id, challenger_profile_id, opponent_profile_id, challenge_type, scheduled_at, location_name, status, is_open)
    values (pg_catalog.gen_random_uuid(), 3, '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'casual', now() + interval '1 day', 'Race Court', 'pending', false);
    return 'created';
  exception when sqlstate 'P0001' then
    return 'unavailable';
  end;
  $function$;
  create function public.loop_4_2a_race_block()
  returns boolean language plpgsql security invoker set search_path = '' as $function$
  begin
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('20000000-0000-4000-8000-000000000005:20000000-0000-4000-8000-000000000006', 0));
    perform pg_catalog.pg_sleep(0.2);
    return public.social_block_profile('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005');
  end;
  $function$;
$setup$);
select extensions.dblink_connect(
  'loop42a_challenge',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_connect(
  'loop42a_block',
  format('hostaddr=%s port=%s dbname=%I user=postgres password=postgres', inet_server_addr(), current_setting('port'), current_database())
);
select extensions.dblink_send_query('loop42a_challenge', $$select public.loop_4_2a_race_challenge(true)$$);
select pg_catalog.pg_sleep(0.05);
select extensions.dblink_send_query('loop42a_block', $$select public.social_block_profile('10000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005')$$);
select * from extensions.dblink_get_result('loop42a_challenge') as result(state text);
select * from extensions.dblink_get_result('loop42a_block') as result(blocked boolean);
select * from extensions.dblink_get_result('loop42a_challenge') as result(state text);
select * from extensions.dblink_get_result('loop42a_block') as result(blocked boolean);
select extensions.is(
  (select count(*) from public.challenges where challenger_profile_id = '20000000-0000-4000-8000-000000000005' and opponent_profile_id = '20000000-0000-4000-8000-000000000006' and status = 'canceled'),
  1::bigint,
  'challenge-first race is atomically canceled by subsequent block'
);
select extensions.dblink_exec('loop42a_setup', $setup$
  delete from public.profile_blocks where blocker_profile_id = '20000000-0000-4000-8000-000000000006' and blocked_profile_id = '20000000-0000-4000-8000-000000000005';
$setup$);
select extensions.dblink_send_query('loop42a_block', $$select public.loop_4_2a_race_block()$$);
select pg_catalog.pg_sleep(0.05);
select extensions.dblink_send_query('loop42a_challenge', $$select public.loop_4_2a_race_challenge(false)$$);
select * from extensions.dblink_get_result('loop42a_block') as result(blocked boolean);
select extensions.is(
  (select state from extensions.dblink_get_result('loop42a_challenge') as result(state text)),
  'unavailable',
  'block-first race rejects direct challenge after lock release'
);
select * from extensions.dblink_get_result('loop42a_block') as result(blocked boolean);
select * from extensions.dblink_get_result('loop42a_challenge') as result(state text);
select extensions.dblink_exec('loop42a_setup', $setup$
  delete from public.profile_blocks where blocker_profile_id = '20000000-0000-4000-8000-000000000006' and blocked_profile_id = '20000000-0000-4000-8000-000000000005';
  insert into public.challenges (id, sport_id, challenger_profile_id, opponent_profile_id, challenge_type, scheduled_at, location_name, status, is_open)
  values ('30000000-0000-4000-8000-000000000005', 3, '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006', 'casual', now() + interval '1 day', 'Race Court', 'pending', false);
$setup$);
select extensions.dblink_send_query('loop42a_block', $$select public.loop_4_2a_race_block()$$);
select pg_catalog.pg_sleep(0.05);
select extensions.dblink_send_query('loop42a_challenge', $$select count(*) from public.social_accept_challenge('10000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000005', false)$$);
select * from extensions.dblink_get_result('loop42a_block') as result(blocked boolean);
select extensions.is(
  (select count from extensions.dblink_get_result('loop42a_challenge') as result(count bigint)),
  0::bigint,
  'block-first race prevents pending direct acceptance'
);
select extensions.is(
  (select status::text from public.challenges where id = '30000000-0000-4000-8000-000000000005'),
  'canceled',
  'block-first race leaves direct challenge canceled'
);
select extensions.dblink_disconnect('loop42a_challenge');
select extensions.dblink_disconnect('loop42a_block');

select extensions.dblink_exec('loop42a_setup', $cleanup$
  drop function public.loop_4_2a_slow_friend_request();
  drop function public.loop_4_2a_race_challenge(boolean);
  drop function public.loop_4_2a_race_block();
  delete from public.challenges
  where challenger_profile_id = '20000000-0000-4000-8000-000000000005'
    and opponent_profile_id = '20000000-0000-4000-8000-000000000006';
  delete from public.profile_blocks
  where blocker_profile_id in ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006')
     or blocked_profile_id in ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006');
  delete from public.friend_relationships
  where profile_a_id = '20000000-0000-4000-8000-000000000005'
    and profile_b_id = '20000000-0000-4000-8000-000000000006';
  delete from public.profiles
  where id in ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000006');
  delete from auth.users
  where id in ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006');
$cleanup$);
select extensions.dblink_disconnect('loop42a_setup');

-- Social operations must not mutate confirmed history or progression ledgers.
select extensions.is(
  (select count(*) from public.matches where result_status = 'confirmed'),
  (select confirmed_matches from loop_4_2a_history_snapshot),
  'confirmed match history is unchanged'
);
select extensions.is(
  (select count(*) from public.match_rating_ledger),
  (select rating_rows from loop_4_2a_history_snapshot),
  'rating history is unchanged'
);
select extensions.is(
  (select count(*) from public.profile_xp_ledger),
  (select xp_rows from loop_4_2a_history_snapshot),
  'XP history is unchanged'
);
select extensions.is(
  (select coalesce(sum(matches_played), 0) from public.profile_stats),
  (select matches_played from loop_4_2a_history_snapshot),
  'profile match statistics are unchanged'
);
select extensions.is(
  (select coalesce(sum(xp), 0) from public.profile_stats),
  (select total_xp from loop_4_2a_history_snapshot),
  'profile XP totals are unchanged'
);

select * from extensions.finish();
rollback;
