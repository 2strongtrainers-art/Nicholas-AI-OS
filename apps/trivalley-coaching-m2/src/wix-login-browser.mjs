// TriValley FIT Milestone 2 Wix-member OAuth PKCE adapter (staging only).
// This adapter NEVER grants coaching roles and stores no member access/refresh tokens.
// Official flow: https://dev.wix.com/docs/go-headless/authentication/members/wix-login-page/add-a-wix-login-page-rest
const TOKEN_URL='https://www.wixapis.com/oauth2/token';
const REDIRECT_URL='https://www.wixapis.com/_api/redirects-api/v1/redirect-session';
const MEMBER_URL='https://www.wixapis.com/members/v1/members/my?fieldSet=FULL';
const PENDING_KEY='trivalley_coaching_oauth_pkce_v1';
const MAX_AGE_MS=600000;
const CLIENT_ID='82db080c-df7a-4995-9e72-d9fe9babd503';
const CALLBACK_URI='https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/index.html';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function b64url(bytes) {
  const raw=Array.from(bytes,v=>String.fromCharCode(v)).join('');
  return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
function isAllowedLoginUrl(value) {
  try {
    const u=new URL(value);
    if(u.protocol!=='https:'||u.username||u.password)return false;
    const h=u.hostname.toLowerCase();
    return h==='trivalley.fit'||h==='www.trivalley.fit'||
      h.endsWith('.wix.com')||h.endsWith('.wixsite.com')||h.endsWith('.wixsite-host.com');
  }catch{return false}
}
async function readJson(res){
  if(!res?.ok)throw new Error('Wix authentication request failed');
  const body=await res.text();
  if(body.length>65536)throw new Error('Authentication response exceeds safety limit');
  try{return JSON.parse(body)}catch{throw new Error('Invalid Wix authentication response')}
}
async function post(fetchImpl,url,body,token) {
  return readJson(await fetchImpl(url,{
    method:'POST',headers:{'content-type':'application/json',...(token?{authorization:token}:{})},
    body:JSON.stringify(body),redirect:'error'
  }));
}
export function createWixMemberLogin({
  fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,
  storage=globalThis.sessionStorage,now=()=>Date.now(),
  clientId=CLIENT_ID,redirectUri=CALLBACK_URI
}={}) {
  if(typeof fetchImpl!=='function'||!cryptoImpl?.getRandomValues||!cryptoImpl?.subtle ||
    !storage?.getItem||!storage?.setItem||!storage?.removeItem)
    throw new Error('Secure browser authentication prerequisites missing');
  if(!UUID.test(clientId)||!redirectUri.startsWith('https://'))
    throw new Error('Wix login configuration invalid');
  const random=()=>b64url(cryptoImpl.getRandomValues(new Uint8Array(32)));
  async function begin() {
    const codeVerifier=random(),state=random();
    const challenge=b64url(new Uint8Array(await cryptoImpl.subtle.digest(
      'SHA-256',new TextEncoder().encode(codeVerifier))));
    storage.setItem(PENDING_KEY,JSON.stringify({codeVerifier,state,clientId,redirectUri,createdAt:now()}));
    try {
      const visitor=await post(fetchImpl,TOKEN_URL,{clientId,grantType:'anonymous'});
      if(typeof visitor.access_token!=='string'||visitor.access_token.length<10)
        throw new Error('Missing Wix visitor token');
      const response=await post(fetchImpl,REDIRECT_URL,{
        auth:{authRequest:{redirectUri,clientId,codeChallenge:challenge,
          codeChallengeMethod:'S256',responseMode:'fragment',
          responseType:'code',scope:'offline_access',state}}
      },visitor.access_token);
      const loginUrl=response?.redirectSession?.fullUrl;
      if(typeof loginUrl!=='string'||!isAllowedLoginUrl(loginUrl))
        throw new Error('Untrusted Wix login URL rejected');
      return {loginUrl,expectedState:state};
    }catch(e){storage.removeItem(PENDING_KEY);throw e}
  }
  async function complete(callbackUrl) {
    let url;
    try{url=new URL(callbackUrl)}catch{throw new Error('Invalid OAuth callback URL')}
    if(url.origin+url.pathname!==redirectUri)throw new Error('OAuth callback origin mismatch');
    const params=new URLSearchParams(url.hash.replace(/^#/,''));
    if(params.has('error'))throw new Error('Wix login cancelled or declined');
    const code=params.get('code'),state=params.get('state');
    if(typeof code!=='string'||!code||code.length>4096||!state||state.length>256)
      throw new Error('Missing OAuth authorization code or state');
    let pending;
    try{pending=JSON.parse(storage.getItem(PENDING_KEY)||'null')}catch{pending=null}
    storage.removeItem(PENDING_KEY);
    if(!pending||pending.clientId!==clientId||pending.redirectUri!==redirectUri||
       pending.state!==state||!Number.isFinite(pending.createdAt)||
       now()-pending.createdAt<0||now()-pending.createdAt>MAX_AGE_MS||
       typeof pending.codeVerifier!=='string'||pending.codeVerifier.length<43)
       throw new Error('OAuth state missing, stale or mismatched');
    const result=await post(fetchImpl,TOKEN_URL,{
      clientId,grantType:'authorization_code',redirectUri,
      code,codeVerifier:pending.codeVerifier
    });
    const accessToken=result?.access_token;
    if(typeof accessToken!=='string'||accessToken.length<10)
      throw new Error('Wix member token missing');
    const info=await readJson(await fetchImpl(MEMBER_URL,{
      method:'GET',headers:{authorization:accessToken,accept:'application/json'},redirect:'error'
    }));
    if(info?.member?.status!=='APPROVED'||!UUID.test(info?.member?.id||''))
      throw new Error('Wix member is not approved');
    // Authenticated Wix membership does not imply a TriValley coaching entitlement.
    return {
      memberId:info.member.id,accessToken,
      expiresInSeconds:Math.min(14400,Number(result.expires_in)||14400),
      source:'wix-main-business-site',cleanCallbackUrl:redirectUri+'#/home'
    };
  }
  return {
    begin,
    complete,
    hasPending:()=>storage.getItem(PENDING_KEY)!==null,
    cancel:()=>storage.removeItem(PENDING_KEY),
    config:{clientId,redirectUri}
  };
}
