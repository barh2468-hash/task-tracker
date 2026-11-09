let viewerAccess = false;
export function setViewerAccess(enabled) {viewerAccess = enabled === true;}

// Convenience routing only. The server verifies the account, server-owned app
// metadata and request policy independently; browser state grants no privileges.
export function viewerFetch(upstream,supabaseUrl) {
  return async (input,init = {}) => {
    if (!viewerAccess) return upstream(input,init);
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== new URL(supabaseUrl).origin || url.pathname.startsWith('/auth/v1/')) return upstream(input,init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    return upstream(`${supabaseUrl}/functions/v1/viewer-read-api`,{
      method:'POST',signal:init.signal,
      headers:{Authorization:headers.get('authorization') || '',apikey:headers.get('apikey') || '','Content-Type':'application/json'},
      body:JSON.stringify({path:url.pathname+url.search,method,body:init.body,
        headers:Object.fromEntries(['accept','range','range-unit','prefer'].filter(name=>headers.has(name)).map(name=>[name,headers.get(name)]))}),
    });
  };
}
