// Investigation reproducer for the unmodified c901db82 implementation.
// Default mode preserves the original known-defect reproducer. Set SECURITY_QA_MODE=regression
// for fixed-code assertions. The original findings remain recorded in the audit documents.
// Run only in a disposable local Supabase project with the reviewed functions and a verified
// PostgREST max-row cap of 20. The caller must restore the previous local cap afterward.
// Requires SECURITY_QA_EXPECTED_MAX_ROWS=20; SUPABASE_CLI_PATH may select the local CLI.
// Creates unique synthetic users, exercises real local HTTP handlers, cleans up only its fixtures.
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict'),{randomUUID}=require('crypto');
const cfg=JSON.parse(cp.execFileSync(process.env.SUPABASE_CLI_PATH ?? 'supabase',['status','-o','json'],{stdio:['ignore','pipe','ignore']}));
const destination=new URL(cfg.API_URL);
assert(['127.0.0.1','localhost','[::1]'].includes(destination.hostname),'Local loopback backend required');
assert.equal(process.env.SECURITY_QA_EXPECTED_MAX_ROWS,'20','Explicit disposable-local 20-row test configuration required');
const regression=process.env.SECURITY_QA_MODE==='regression';
const failures=[];
function regressionCheck(name, condition){if(regression){checks++;if(!condition)failures.push(name);}}
const run=randomUUID().slice(0,8),password='LocalOnly-'+randomUUID()+'!',users=[],profiles=[],results=[];let checks=0;
async function call(path,{token=cfg.SERVICE_ROLE_KEY,key=cfg.SERVICE_ROLE_KEY,method='GET',body,prefer}={}){
 const url=new URL(path,cfg.API_URL);assert.equal(url.origin,cfg.API_URL);
 const r=await fetch(url,{method,headers:{apikey:key,Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'}),...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,payload:await r.json().catch(()=>null),range:r.headers.get('content-range')};
}
function ok(r,status=200){checks++;assert.equal(r.status,status,JSON.stringify(r.payload));return r.payload;}
function record(name,value){results.push({name,...value});console.log(name+': '+JSON.stringify(value));}
async function fixture(n){let email=`sec2a-${run}-${n}@example.test`;let auth=ok(await call('/auth/v1/admin/users',{method:'POST',body:{email,password,email_confirm:true}}));users.push(auth.id);let id=randomUUID();profiles.push(id);let username=`sec2a${run}${n}`;
 ok(await call('/rest/v1/profiles',{method:'POST',prefer:'return=minimal',body:{id,auth_user_id:auth.id,email,username,display_name:'Security QA '+n,vancouver_area:'Downtown',availability_status:'now',challenge_radius_km:50,onboarding_completed:true}}),201);
 ok(await call('/rest/v1/profile_stats',{method:'POST',prefer:'return=minimal',body:{profile_id:id}}),201);
 ok(await call('/rest/v1/profile_sports',{method:'POST',prefer:'return=minimal',body:{profile_id:id,sport_id:3,skill_level:'intermediate',is_active:true}}),201);
 let session=ok(await call('/auth/v1/token?grant_type=password',{method:'POST',key:cfg.ANON_KEY,body:{email,password}}));return {id,username,token:session.access_token};}
const edge=(a,n,body)=>call('/functions/v1/'+n,{token:a.token,key:cfg.ANON_KEY,method:'POST',body});
const search=(a,q)=>call('/functions/v1/search-profiles?query='+encodeURIComponent(q),{token:a.token,key:cfg.ANON_KEY});
const profile=(a,id)=>call('/functions/v1/get-opponent-profile?profileId='+id,{token:a.token,key:cfg.ANON_KEY});
const social=(a,action,b)=>edge(a,'manage-social',{action,targetProfileId:b.id});
const base={scheduledAt:new Date(Date.now()+86400000).toISOString(),locationName:'Local Security Test',challengeType:'casual'};
const generic=(a,b,extra={})=>edge(a,'create-challenge',{...base,sportId:3,isOpen:false,opponentProfileId:b,...extra});
const direct=(a,b)=>edge(a,'create-direct-challenge',{...base,sport:'pickleball',opponentProfileId:b});
const row=async id=>ok(await call('/rest/v1/challenges?id=eq.'+id+'&select=id,status,opponent_profile_id,is_open'))[0];
(async()=>{try{
 let a=await fixture('actor'),targets=[];for(let n=0;n<21;n++)targets.push(await fixture(String(n).padStart(2,'0')));let c=await fixture('other');
 console.log('Created 23 isolated synthetic accounts; no credentials logged.');
 // Accepted match and friendship/request must survive/be terminated according to policy.
 let accepted=ok(await direct(a,targets[20].id),201).challenge.id;ok(await edge(targets[20],'respond-to-challenge',{challengeId:accepted,action:'accept'}));
 ok(await social(a,'send_request',targets[0]));ok(await social(targets[0],'accept_request',a));ok(await social(a,'send_request',targets[1]));
 let opens=[];for(let t of targets)opens.push(ok(await edge(t,'create-open-challenge',{...base,sport:'pickleball'}),201).challenge.id);
 const blocked=new Set();
 for(let size of [0,1,19,20,21]){
  while(blocked.size<size){let i=blocked.size;ok(await social(a,'block',targets[i]));blocked.add(targets[i].id);}
  let br=await call('/rest/v1/profile_blocks?blocker_profile_id=eq.'+a.id+'&select=blocked_profile_id',{prefer:'count=exact'});let returned=ok(br, size > 20 ? 206 : 200);
  let s=ok(await search(a,'sec2a'+run)).profiles,n=ok(await edge(a,'get-nearby-players',{sport:'pickleball',availability:'now'})).players,o=ok(await edge(a,'get-open-challenges',{sport:'pickleball'})).challenges;
  const leaking={search:s.filter(p=>blocked.has(p.id)).length,nearby:n.filter(p=>blocked.has(p.id??p.profileId)).length,open:o.filter(p=>opens.slice(0,size).includes(p.id)).length};
  let blockedUI=ok(await edge(a,'get-social-relationships',{action:'blocked'})).data.blocked;
  let friends=ok(await edge(a,'get-social-relationships',{action:'friends'})).data.friends,requests=ok(await edge(a,'get-social-relationships',{action:'requests'})).data;
  assert(!friends.some(x=>blocked.has(x.profile.id)));assert(![...requests.incoming,...requests.outgoing].some(x=>blocked.has(x.profile.id)));checks+=2;
  record('boundary '+size,{stored:size,returned:returned.length,contentRange:br.range,blockedUiRows:blockedUI.length,leaking,friendsRequestsExcludeBlocked:true});
  if(size<=20)assert.deepEqual(leaking,{search:0,nearby:0,open:0});
  else {assert.equal(returned.length,20);if(!regression)assert(Object.values(leaking).some(x=>x>0));assert.equal(blockedUI.length,regression ? 21 : 20);}
  regressionCheck('all discovery excludes blocks at '+size,Object.values(leaking).every(x=>x===0));
 }
 // Identify actual omitted block without relying on insert-order assumption.
 let visibleBlockRows=ok(await call('/rest/v1/profile_blocks?blocker_profile_id=eq.'+a.id+'&select=blocked_profile_id'));
 let b=targets.find(t=>!visibleBlockRows.some(r=>r.blocked_profile_id===t.id));assert(b);
 for(let [actor,target,label] of [[a,b,'blocking actor'],[b,a,'blocked actor']]){
  const out={profile:await profile(actor,target.id),generic:await generic(actor,target.id),direct:await direct(actor,target.id),request:await social(actor,'send_request',target)};
  ok(out.profile,404);ok(out.generic,404);ok(out.direct,404);ok(out.request,404);
  record(label+' omitted-block authorization',{profile:out.profile.status,generic:out.generic.status,direct:out.direct.status,request:out.request.status,body:out.generic.payload});
 }
 let bi=targets.indexOf(b);ok(await edge(a,'accept-open-challenge',{challengeId:opens[bi]}),409);
 let stale=ok(await edge(a,'get-open-challenges',{sport:'pickleball'})).challenges.some(x=>x.id===opens[bi]);regressionCheck('stale Join refresh removes blocked challenge',!stale);record('stale blocked listing',{joinStatus:409,stillListedAfterAuthoritativeRefresh:stale});
 const missing=await generic(a,randomUUID());ok(missing,404);record('nonexistent target',{status:missing.status,body:missing.payload});
 // Accepted match remains completable after block and scheduled start.
 if(regression)ok(await call('/rest/v1/challenges?id=eq.'+accepted,{method:'PATCH',body:{scheduled_at:new Date(Date.now()-3600000).toISOString()}}),204);
 let match=ok(await call('/rest/v1/matches?challenge_id=eq.'+accepted+'&select=id'))[0];assert(match);
 ok(await edge(a,'submit-match-result',{matchId:match.id,winnerProfileId:a.id,resultOutcome:'win',scoreSummary:'11-7'}));ok(await edge(targets[20],'confirm-match-result',{matchId:match.id}));assert.equal((await row(accepted)).status,'completed');record('accepted match after block',{submit:200,confirm:200,status:'completed'});
 // Separate nonblocked user verifies ordinary sends, authorization and stale lifecycle failures.
 let ordinary=ok(await generic(a,c.id)).challenge.id;
 ok(await edge(targets[0],'respond-to-challenge',{challengeId:ordinary,action:'accept'}),403);
 ok(await edge(a,'respond-to-challenge',{challengeId:ordinary,action:'cancel'}));ok(await edge(c,'respond-to-challenge',{challengeId:ordinary,action:'accept'}),409);
 let normal=ok(await direct(a,c.id),201).challenge.id;ok(await edge(c,'respond-to-challenge',{challengeId:normal,action:'accept'}));ok(await edge(c,'respond-to-challenge',{challengeId:normal,action:'accept'}),409);
 let openCanceled=ok(await edge(c,'create-open-challenge',{...base,sport:'pickleball'}),201).challenge.id;ok(await edge(c,'cancel-open-challenge',{challengeId:openCanceled}));ok(await edge(a,'accept-open-challenge',{challengeId:openCanceled}),409);
 let openTaken=ok(await edge(c,'create-open-challenge',{...base,sport:'pickleball'}),201).challenge.id;ok(await edge(a,'accept-open-challenge',{challengeId:openTaken}));ok(await edge(targets[0],'accept-open-challenge',{challengeId:openTaken}),409);
 record('challenge lifecycle',{ordinaryGeneric:200,ordinaryDirect:201,unauthorizedAccept:403,canceledDirectAccept:409,duplicateAccept:409,canceledOpenJoin:409,alreadyTakenJoin:409,ordinaryJoin:200});
 for(let [name,body] of [['malformed UUID',{opponentProfileId:'not-a-uuid'}],['malformed field type',{locationName:42}],['invalid enum',{challengeType:'invalid-type'}],['backend FK failure',{sportId:32767}]]){
  let r=await generic(a,c.id,body);assert(r.status>=400);regressionCheck(name+' safe response',r.status===400 && r.payload.error==='Missing or invalid challenge fields');record(name,{status:r.status,body:r.payload});
 }
 let malformed=await edge(a,'create-challenge',{});ok(malformed,400);record('missing required fields',{status:malformed.status,body:malformed.payload});
 // Existing pending invitation whose scheduled time has elapsed: fixture only, not a production mutation.
 let past=randomUUID();ok(await call('/rest/v1/challenges',{method:'POST',prefer:'return=minimal',body:{id:past,sport_id:3,challenger_profile_id:c.id,opponent_profile_id:null,is_open:true,status:'pending',scheduled_at:new Date(Date.now()-3600000).toISOString(),location_name:'Expired Local QA',challenge_type:'casual'}}),201);
 let listed=ok(await edge(a,'get-open-challenges',{sport:'pickleball'})).challenges.some(x=>x.id===past);let joined=await edge(a,'accept-open-challenge',{challengeId:past});record('past-scheduled open challenge',{listed,joinStatus:joined.status,persistedStatus:(await row(past)).status});
 regressionCheck('expired direct-ID Join rejected',joined.status===409 && (await row(past)).status==='pending' && !listed);
 if(regression){
  // Test the exact production cutoff predicate with fixed database timestamps.
  const start='2030-01-01T12:00:00.000000Z';
  for(const [label,time,expected] of [['before','2030-01-01T11:59:59.999999Z',true],['exact',start,false],['after','2030-01-01T12:00:00.000001Z',false]]){
   assert.equal(ok(await call('/rest/v1/rpc/social_open_join_before_cutoff',{method:'POST',body:{scheduled_start:start,backend_time:time}})),expected);
   record('cutoff '+label,{allowed:expected});
  }
  for(const rpc of ['social_discover_profiles','social_discover_open_challenges']){
   const denied=await call('/rest/v1/rpc/'+rpc,{token:a.token,key:cfg.ANON_KEY,method:'POST',body:{trusted_actor_auth_user_id:users[0]}});
   ok(denied,403);
  }
  // Hold the challenge row across its deadline. Acceptance must sample the
  // database clock AFTER the wait, not use the request's initial timestamp.
  const locked=randomUUID();
  ok(await call('/rest/v1/challenges',{method:'POST',prefer:'return=minimal',body:{id:locked,sport_id:3,challenger_profile_id:c.id,is_open:true,status:'pending',scheduled_at:new Date(Date.now()+2000).toISOString(),location_name:'Cutoff lock QA',challenge_type:'casual'}}),201);
  assert.equal(cfg.API_URL,'http://127.0.0.1:54821','Lock test is restricted to the named isolated stack');
  const locker=cp.spawn('docker',['exec','-i','supabase_db_rival-nearby-fix','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{stdio:['pipe','pipe','pipe']});
  const lockedReady=new Promise((resolve,reject)=>{let output='';locker.stdout.on('data',chunk=>{output+=chunk;if(output.includes('LOCK_READY'))resolve();});locker.on('error',reject);locker.on('exit',code=>{if(!output.includes('LOCK_READY'))reject(new Error('Local row lock was not acquired: '+code));});});
  const released=new Promise((resolve,reject)=>locker.on('exit',code=>code===0?resolve():reject(new Error('Local lock worker failed'))));
  locker.stdin.end("begin; select id from public.challenges where id='"+locked+"' for update; select 'LOCK_READY'; select pg_sleep(3); commit;");
  await lockedReady;
  try {ok(await edge(a,'accept-open-challenge',{challengeId:locked}),409);} finally {await released;}
  assert.equal((await row(locked)).status,'pending');
  record('Join waiting across cutoff',{joinStatus:409,persistedStatus:'pending'});
 }
 // Test reverse-direction block completeness: remove outgoing rows through supported API; blockers now targets.
 for(let t of targets){ok(await social(a,'unblock',t));ok(await social(t,'block',a));}
 let rs=ok(await search(a,'sec2a'+run)).profiles,rn=ok(await edge(a,'get-nearby-players',{sport:'pickleball',availability:'now'})).players,ro=ok(await edge(a,'get-open-challenges',{sport:'pickleball'})).challenges;
 regressionCheck('reverse direction excludes all blocked profiles',!rs.some(p=>targets.some(t=>t.id===p.id))&&!rn.some(p=>targets.some(t=>t.id===(p.id??p.profileId)))&&!ro.some(p=>opens.includes(p.id)));
 record('reverse blocks above cap',{searchLeaks:rs.filter(p=>targets.some(t=>t.id===p.id)).length,nearbyLeaks:rn.filter(p=>targets.some(t=>t.id===(p.id??p.profileId))).length,openLeaks:ro.filter(p=>opens.includes(p.id)).length,ownBlockedList:ok(await edge(a,'get-social-relationships',{action:'blocked'})).data.blocked.length});
 console.log('Investigation assertions completed: '+checks);
 assert.deepEqual(failures,[], 'Fixed-code regression failures');
}finally{
 // Remove only this run's dependent result fixtures before deleting Auth users.
 // Canonical rating FKs intentionally prevent deleting a finalized match first.
 let failed=0;
 for (const id of profiles) {
  try {
   const matches=ok(await call('/rest/v1/matches?or=(challenger_profile_id.eq.'+id+',opponent_profile_id.eq.'+id+')&select=id'));
   for(const match of matches){
    ok(await call('/rest/v1/match_rating_ledger?match_id=eq.'+match.id,{method:'DELETE'}),204);
    ok(await call('/rest/v1/profile_xp_ledger?match_id=eq.'+match.id,{method:'DELETE'}),204);
    ok(await call('/rest/v1/matches?id=eq.'+match.id,{method:'DELETE'}),204);
   }
   ok(await call('/rest/v1/challenges?or=(challenger_profile_id.eq.'+id+',opponent_profile_id.eq.'+id+')',{method:'DELETE'}),204);
  } catch {failed++;}
 }
 for(let id of users.reverse()){try{let r=await call('/auth/v1/admin/users/'+id,{method:'DELETE'});if(r.status!==200)failed++;}catch{failed++;}}
 console.log('FINAL '+JSON.stringify({checks,results,cleanupFailures:failed}));
 console.log('Synthetic account cleanup failures: '+failed);assert.equal(failed,0);
}})().catch(e=>{console.error(e.message);process.exitCode=1;});
