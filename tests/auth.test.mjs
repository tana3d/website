import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin } from '../src/lib/auth.ts';
test('local admin is denied in production and on non-loopback hosts',async()=>{
 const env={LOCAL_ADMIN:'true'};
 assert.equal(await isAdmin(new Request('http://127.0.0.1/admin'),env,true),true);
 assert.equal(await isAdmin(new Request('http://127.0.0.1/admin'),env,false),false);
 assert.equal(await isAdmin(new Request('https://tana.gg/admin'),env,true),false);
 assert.equal(await isAdmin(new Request('https://tana.gg/admin',{headers:{'Cf-Access-Jwt-Assertion':'forged'}}),env,false),false);
 assert.equal(await isAdmin(new Request('https://tana.gg/admin'),{ACCESS_TEAM_DOMAIN:'wrong.example.com',ACCESS_AUD:'x'},false),false);
});
