import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { readRequest, viewerAuthorized } from './policy.js';
const cors = {
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Expose-Headers':'content-range,range-unit',
  'Cache-Control':'no-store',
};
const fail = (status:number,message:string) => Response.json({message,code:'42501'},{status,headers:cors});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors});
  if (req.method !== 'POST') return fail(405,'viewer.readOnly');
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const client = createClient(url, service, {auth:{persistSession:false,autoRefreshToken:false}});
    const bearer = req.headers.get('authorization') || '';
    if (!bearer.startsWith('Bearer ')) return fail(401,'Unauthorized');
    const {data:auth,error} = await client.auth.getUser(bearer.slice(7));
    if (error || !auth.user) return fail(401,'Unauthorized');
    const {data:profile,error:profileError} = await client.from('profiles').select('role').eq('id',auth.user.id).maybeSingle();
    if (profileError || !viewerAuthorized(auth.user,profile)) return fail(403,'viewer.readOnly');
    const raw = await req.text();
    if (raw.length > 128000) return fail(413,'viewer.readOnly');
    const payload = JSON.parse(raw);
    let checked;
    try {checked = readRequest(payload);} catch {return fail(403,'viewer.readOnly');}
    const headers = new Headers({apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'});
    for (const name of ['accept','range','range-unit'])
      if (typeof payload.headers?.[name] === 'string') headers.set(name,payload.headers[name]);
    // Only count preferences are relevant to reads; no arbitrary headers/schema.
    if (typeof payload.headers?.prefer === 'string' && /(?:^|,)\s*count=(exact|planned|estimated)(?:,|$)/.test(payload.headers.prefer))
      headers.set('Prefer',payload.headers.prefer.match(/count=(exact|planned|estimated)/)[0]);
    const response = await fetch(`${url}${checked.path}`,{method:checked.method,headers,body:checked.body,redirect:'error'});
    const outputHeaders = new Headers(cors);
    for (const name of ['content-type','content-range','range-unit'])
      if (response.headers.has(name)) outputHeaders.set(name,response.headers.get(name)!);
    return new Response(checked.method === 'HEAD' ? null : response.body,{status:response.status,headers:outputHeaders});
  } catch {return fail(503,'viewer.loadError');}
});
