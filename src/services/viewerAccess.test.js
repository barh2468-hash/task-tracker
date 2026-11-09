import test from 'node:test';
import assert from 'node:assert/strict';
import {setViewerAccess,viewerFetch} from './viewerAccess.js';
test('viewer database requests go to the authenticated read gateway, while login stays direct',async()=>{
  const calls=[]; const fetcher=viewerFetch(async(...args)=>{calls.push(args);return new Response('{}');},'https://example.supabase.co');
  setViewerAccess(true);
  try {
    await fetcher('https://example.supabase.co/rest/v1/projects?select=*',{headers:{authorization:'Bearer user-token',apikey:'public-key',range:'0-99'}});
    assert.equal(calls[0][0],'https://example.supabase.co/functions/v1/viewer-read-api');
    const body=JSON.parse(calls[0][1].body);
    assert.equal(body.path,'/rest/v1/projects?select=*'); assert.equal(body.method,'GET');
    assert.equal(body.headers.range,'0-99');
    assert.equal(calls[0][1].headers.Authorization,'Bearer user-token');
    await fetcher('https://example.supabase.co/auth/v1/token',{method:'POST'});
    assert.equal(calls[1][0],'https://example.supabase.co/auth/v1/token');
    setViewerAccess(false);
    await fetcher('https://example.supabase.co/rest/v1/projects',{method:'POST',body:'{}'});
    assert.equal(calls[2][0],'https://example.supabase.co/rest/v1/projects');
  } finally {setViewerAccess(false);}
});
