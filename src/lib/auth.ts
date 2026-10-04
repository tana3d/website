import { SignJWT, jwtVerify, base64url } from 'jose';
import type { Bindings } from './types';
export const ADMIN_ORIGIN='https://admin.tana.gg';
export const SESSION_COOKIE='__Host-tana-admin';
const STATE_COOKIE='__Host-tana-oauth';
const SESSION_SECONDS=12*60*60;
const audience='tana-library-admin';
const noStore={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
const key=(env:Bindings)=>new TextEncoder().encode(env.ADMIN_SESSION_SECRET ?? '');
export function cookie(request:Request,name:string){return request.headers.get('Cookie')?.split(';').map(part=>part.trim()).find(part=>part.startsWith(name+'='))?.slice(name.length+1);}
function setCookie(name:string,value:string,seconds:number){return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;}
function configured(env:Bindings){return !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET && !!env.GITHUB_ADMIN_ID && (env.ADMIN_SESSION_SECRET?.length ?? 0)>=32;}
async function sign(env:Bindings,payload:Record<string,string>,purpose:string,seconds:number){
 return new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setIssuer(ADMIN_ORIGIN).setAudience(purpose).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+seconds).sign(key(env));
}
export async function isAdmin(request:Request,env:Bindings,localBuild=false):Promise<boolean>{
 const host=new URL(request.url).hostname;
 if(localBuild && env.LOCAL_ADMIN==='true' && ['localhost','127.0.0.1','[::1]'].includes(host))return true;
 if(host!=='admin.tana.gg' || !env.GITHUB_ADMIN_ID || (env.ADMIN_SESSION_SECRET?.length ?? 0)<32)return false;
 const token=cookie(request,SESSION_COOKIE);if(!token)return false;
 try{const {payload}=await jwtVerify(token,key(env),{issuer:ADMIN_ORIGIN,audience,algorithms:['HS256']});return payload.sub===env.GITHUB_ADMIN_ID;}catch{return false;}
}
export async function beginGithub(request:Request,env:Bindings):Promise<Response>{
 if(new URL(request.url).origin!==ADMIN_ORIGIN || !configured(env))return new Response('Admin sign-in is not available yet.',{status:503,headers:noStore});
 const state=base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
 const verifier=base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=base64url.encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 const authorization=new URL('https://github.com/login/oauth/authorize');
 authorization.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,redirect_uri:ADMIN_ORIGIN+'/api/auth/github/callback',state,scope:'',code_challenge:challenge,code_challenge_method:'S256',allow_signup:'false'}).toString();
 const signed=await sign(env,{state,verifier},'tana-oauth-state',600);
 return new Response(null,{status:302,headers:{...noStore,Location:authorization.href,'Set-Cookie':setCookie(STATE_COOKIE,signed,600)}});
}
export async function completeGithub(request:Request,env:Bindings):Promise<Response>{
 const headers=new Headers(noStore);headers.append('Set-Cookie',setCookie(STATE_COOKIE,'',0));
 const reject=(status:number,message:string)=>{headers.append('Set-Cookie',setCookie(SESSION_COOKIE,'',0));return new Response(message,{status,headers});};
 const url=new URL(request.url),stateToken=cookie(request,STATE_COOKIE);
 if(url.origin!==ADMIN_ORIGIN || !configured(env))return reject(503,'Admin sign-in is not available yet.');
 const code=url.searchParams.get('code'),state=url.searchParams.get('state');
 if(!code || code.length>512 || !state || !stateToken)return reject(400,'This sign-in request expired. Please start again.');
 try{
  const {payload}=await jwtVerify(stateToken,key(env),{issuer:ADMIN_ORIGIN,audience:'tana-oauth-state',algorithms:['HS256']});
  if(payload.state!==state || typeof payload.verifier!=='string')return reject(400,'This sign-in request expired. Please start again.');
  const exchanged=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:ADMIN_ORIGIN+'/api/auth/github/callback',code_verifier:payload.verifier})});
  const token=await exchanged.json() as {access_token?:string;error?:string};
  if(!exchanged.ok || token.error || !token.access_token)return reject(401,'GitHub could not complete sign-in. Please try again.');
  const identity=await fetch('https://api.github.com/user',{headers:{Authorization:`Bearer ${token.access_token}`,Accept:'application/vnd.github+json','User-Agent':'Tana-Library','X-GitHub-Api-Version':'2022-11-28'}});
  const user=await identity.json() as {id?:number;login?:string};
  if(!identity.ok || typeof user.id!=='number' || typeof user.login!=='string')return reject(401,'GitHub could not verify your account.');
  if(String(user.id)!==env.GITHUB_ADMIN_ID)return reject(403,'This admin area is restricted to its owner.');
  const session=await sign(env,{sub:String(user.id),login:user.login},audience,SESSION_SECONDS);
  headers.append('Set-Cookie',setCookie(SESSION_COOKIE,session,SESSION_SECONDS));headers.set('Location',ADMIN_ORIGIN+'/');
  return new Response(null,{status:303,headers});
 }catch{return reject(400,'This sign-in request expired or could not be verified. Please start again.');}
}
export function logout(request:Request){
 if(request.headers.get('Origin')!==ADMIN_ORIGIN)return new Response('Request origin rejected.',{status:403,headers:noStore});
 return new Response(null,{status:303,headers:{...noStore,Location:'/login','Set-Cookie':setCookie(SESSION_COOKIE,'',0)}});
}
