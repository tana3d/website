import test from 'node:test';
import assert from 'node:assert/strict';
import {SignJWT} from 'jose';
import {isAdmin,beginGithub,completeGithub,logout,SESSION_COOKIE,ADMIN_ORIGIN} from '../src/lib/auth.ts';
const env={GITHUB_ADMIN_ID:'6378290',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',ADMIN_SESSION_SECRET:'test-session-secret-with-at-least-32-characters'};
const session=(sub,aud='tana-library-admin',expiry='5m')=>new SignJWT({sub}).setProtectedHeader({alg:'HS256'}).setIssuer(ADMIN_ORIGIN).setAudience(aud).setExpirationTime(expiry).sign(new TextEncoder().encode(env.ADMIN_SESSION_SECRET));
const request=token=>new Request(ADMIN_ORIGIN+'/api/admin/assets',{headers:{Cookie:SESSION_COOKIE+'='+token}});
test('local admin bypass is disabled in production and on non-loopback hosts',async()=>{
 const local={LOCAL_ADMIN:'true'};
 assert.equal(await isAdmin(new Request('http://127.0.0.1/admin'),local,true),true);
 assert.equal(await isAdmin(new Request('http://127.0.0.1/admin'),local,false),false);
 assert.equal(await isAdmin(new Request(ADMIN_ORIGIN),local,true),false);
});
test('admin sessions only authorize the configured GitHub ID on the admin hostname',async()=>{
 const valid=await session('6378290');
 assert.equal(await isAdmin(request(valid),env),true);
 assert.equal(await isAdmin(request(await session('123')),env),false);
 assert.equal(await isAdmin(request(await session('6378290','other-app')),env),false);
 assert.equal(await isAdmin(request(await session('6378290','tana-library-admin',0)),env),false);
 assert.equal(await isAdmin(request(valid+'.forged'),env),false);
 assert.equal(await isAdmin(new Request('https://tana.gg/admin',{headers:{Cookie:SESSION_COOKIE+'='+valid}}),env),false);
});
test('GitHub OAuth verifies signed state, PKCE, and the actual GitHub identity',async t=>{
 let identity=6378290,exchanges=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url)==='https://github.com/login/oauth/access_token'){
   exchanges++;const body=JSON.parse(options.body);
   assert.equal(body.redirect_uri,ADMIN_ORIGIN+'/api/auth/github/callback');
   assert.equal(body.client_secret,env.GITHUB_CLIENT_SECRET);assert.ok(body.code_verifier.length>=43);
   return Response.json({access_token:'test-provider-token'});
  }
  assert.equal(String(url),'https://api.github.com/user');
  assert.equal(options.headers.Authorization,'Bearer test-provider-token');
  return Response.json({id:identity,login:identity===6378290?'samifouad':'other-user'});
 });
 async function start(){const response=await beginGithub(new Request(ADMIN_ORIGIN+'/api/auth/github'),env);assert.equal(response.status,302);const url=new URL(response.headers.get('Location'));assert.equal(url.searchParams.get('scope'),'');assert.equal(url.searchParams.get('code_challenge_method'),'S256');const stateCookie=response.headers.get('Set-Cookie');assert.match(stateCookie,/Secure; HttpOnly; SameSite=Lax/);return {state:url.searchParams.get('state'),cookie:stateCookie.split(';')[0]};}
 function callback(flow,state=flow.state){return new Request(ADMIN_ORIGIN+'/api/auth/github/callback?code=test-code&state='+state,{headers:{Cookie:flow.cookie}});}
 const flow=await start();
 const invalid=await completeGithub(callback(flow,'different-state'),env);assert.equal(invalid.status,400);assert.equal(exchanges,0);
 const success=await completeGithub(callback(flow),env);assert.equal(success.status,303);assert.equal(success.headers.get('Location'),ADMIN_ORIGIN+'/');
 const issued=success.headers.getSetCookie().find(value=>value.startsWith(SESSION_COOKIE+'=')).split(';')[0];
 assert.equal(await isAdmin(new Request(ADMIN_ORIGIN+'/media/draft.png',{headers:{Cookie:issued}}),env),true);
 identity=123;const denied=await completeGithub(callback(await start()),env);assert.equal(denied.status,403);assert.ok(!denied.headers.getSetCookie().some(value=>value.startsWith(SESSION_COOKIE+'=ey')));
});
test('sign-out rejects cross-origin requests and clears the host-only session',()=>{
 assert.equal(logout(new Request(ADMIN_ORIGIN+'/api/auth/logout',{method:'POST',headers:{Origin:'https://other.example'}})).status,403);
 const response=logout(new Request(ADMIN_ORIGIN+'/api/auth/logout',{method:'POST',headers:{Origin:ADMIN_ORIGIN}}));
 assert.equal(response.status,303);assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);assert.ok(!response.headers.get('Set-Cookie').includes('Domain='));
});
