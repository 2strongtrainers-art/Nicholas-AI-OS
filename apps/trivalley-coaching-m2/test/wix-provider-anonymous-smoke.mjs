// One-time public OAuth configuration smoke. This uses an ANONYMOUS Wix
// visitor token only; it does not sign in, redeem a member code, or store
// tokens/client data. Never print access tokens or the Wix login URL.
// Official Wix Headless REST PKCE login flow:
// https://dev.wix.com/docs/go-headless/authentication/members/wix-login-page/add-a-wix-login-page-rest
import {randomBytes,createHash} from 'node:crypto';

const clientId='82db080c-df7a-4995-9e72-d9fe9babd503';
const redirectUri='https://headless-lukuteamnwo-1strongtrainer-140e.wix-site-host.com/index.html';
const tokenUrl='https://www.wixapis.com/oauth2/token';
const redirectUrl='https://www.wixapis.com/_api/redirects-api/v1/redirect-session';
const enc=bytes=>Buffer.from(bytes).toString('base64url');

async function post(url,data,authorization) {
  const response=await fetch(url,{
    method:'POST',
    headers:{'content-type':'application/json', ...(authorization?{authorization}:{})},
    body:JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(13000)
  });
  if(!response.ok)throw new Error('Wix OAuth provider returned HTTP '+response.status);
  const raw=await response.text();
  if(raw.length>65536)throw new Error('OAuth provider returned oversized response');
  try{return JSON.parse(raw)}catch{throw new Error('Wix provider returned invalid JSON')}
}
try {
  const visitor=await post(tokenUrl,{clientId,grantType:'anonymous'});
  if(typeof visitor.access_token!=='string'||visitor.access_token.length<10)
    throw new Error('Anonymous visitor exchange did not return valid token');
  const verifier=enc(randomBytes(32));
  const challenge=enc(createHash('sha256').update(verifier).digest());
  const state=enc(randomBytes(32));
  const redirect=await post(redirectUrl,{
    auth:{authRequest:{
      redirectUri,clientId,codeChallenge:challenge,codeChallengeMethod:'S256',
      responseMode:'fragment',responseType:'code',scope:'offline_access',state
    }}
  },visitor.access_token);
  const url=redirect?.redirectSession?.fullUrl;
  if(typeof url!=='string')throw new Error('No Wix-managed login redirect returned');
  const parsed=new URL(url);
  const host=parsed.hostname.toLowerCase();
  if(parsed.protocol!=='https:'||
    !(host==='trivalley.fit'||host==='www.trivalley.fit'||
      host.endsWith('.wix.com')||host.endsWith('.wixsite.com')||
      host.endsWith('.wixsite-host.com'))) {
    throw new Error('Wix returned unexpected login host');
  }
  console.log(JSON.stringify({status:'WIX_OAUTH_ANONYMOUS_REDIRECT_PASS',
    clientId,redirectConfigured:true,loginUrlReturned:true,
    userSignedIn:false,memberTokenIssued:false,verifiedMember:false}));
}catch(e){
  console.error(JSON.stringify({status:'WIX_OAUTH_ANONYMOUS_REDIRECT_BLOCKED',
    reason:e?.message||'Provider failure'}));
  process.exitCode=1;
}
