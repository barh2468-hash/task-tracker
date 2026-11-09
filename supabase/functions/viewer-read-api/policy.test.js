import test from 'node:test';
import assert from 'node:assert/strict';
import {readRequest,validProjection,viewerAuthorized,VIEWER_EMAIL} from './policy.js';

test('only the named account with server-owned metadata and a demo profile gets full read access',()=>{
  const user={email:VIEWER_EMAIL,app_metadata:{maya_view_all:true}};
  assert.equal(viewerAuthorized(user,{role:'demo'}),true);
  assert.equal(viewerAuthorized({...user,email:'other@example.com'},{role:'demo'}),false);
  assert.equal(viewerAuthorized({email:VIEWER_EMAIL,user_metadata:{maya_view_all:true}},{role:'demo'}),false);
  assert.equal(viewerAuthorized(user,{role:'manager'}),false);
  assert.equal(viewerAuthorized(null,null),false);
});
test('project, task, drawing and profile projections support the real app relationships',()=>{
  for(const projection of [
    '*', '*, profiles:assigned_to(full_name), project_workers(worker_id,profiles:worker_id(full_name,email,role))',
    'id,project_id,title,description,is_done,latest_report_id,created_by,created_at,updated_at,profiles:created_by(full_name)',
    '*,reporter:created_by(full_name)',
    '*,assigned_profile:assigned_drafter(full_name,email),project_drawing_batch_events(id,event_type,old_status,new_status,note,created_at,profiles:created_by(full_name))',
  ]) assert.equal(validProjection(projection),true,projection);
});
test('unknown relations, computed fields and hidden secrets cannot be embedded or aliased',()=>{
  for(const projection of ['gpr_m365_connections(*)','x:gpr_m365_connections(refresh_cipher)',
    'project_workers(x:connection_id(*))','profiles(full_name,push_subscriptions(*))',
    'profiles!inner(email,gpr_m365_oauth_states(*))','"gpr_m365_connections"(*)',
    'profiles(full_name);delete','private.delete_managed_user(*)','create_manager_notifications',
    'profiles((email))','profiles(email','profiles(email))','*::text'])
    assert.equal(validProjection(projection),false,projection);
});
test('every write method and all RPC endpoints are rejected before forwarding',()=>{
  for(const method of ['POST','PATCH','PUT','DELETE'])
    assert.throws(()=>readRequest({path:'/rest/v1/projects',method}));
  for(const method of ['GET','POST'])
    assert.throws(()=>readRequest({path:'/rest/v1/rpc/create_manager_notifications',method}));
  assert.throws(()=>readRequest({path:'/functions/v1/send-push-notification',method:'POST'}));
});
test('credentials, duplicate projection parameters and external destinations are rejected',()=>{
  for(const path of ['/rest/v1/gpr_m365_connections','/rest/v1/push_subscriptions',
    '/rest/v1/gpr_m365_oauth_states','/rest/v1/projects?select=*&select=gpr_m365_connections(*)',
    'https://evil.example/rest/v1/projects','//evil.example/rest/v1/projects',
    '/rest/v1/projects#anything','/rest/v1/projects\\evil'])
    assert.throws(()=>readRequest({path,method:'GET'}),path);
});
test('valid paged reads retain filters, allow HEAD and cap requested limits',()=>{
  const result=readRequest({path:'/rest/v1/projects?select=*&is_archived=eq.false&limit=5000',method:'GET'});
  assert.equal(result.method,'GET'); assert.match(result.path,/is_archived=eq.false/);
  assert.match(result.path,/limit=1000/); assert.equal(result.body,undefined);
  assert.equal(readRequest({path:'/rest/v1/projects',method:'HEAD'}).method,'HEAD');
});
test('storage access permits signing existing files, never upload, deletion, copy or move',()=>{
  const result=readRequest({path:'/storage/v1/object/sign/project-documents/project/report.pdf',method:'POST',body:JSON.stringify({expiresIn:86400})});
  assert.equal(JSON.parse(result.body).expiresIn,3600);
  assert.deepEqual(JSON.parse(readRequest({path:'/storage/v1/object/sign/project-photos',method:'POST',body:{expiresIn:60,paths:['p/photo.jpg']}}).body).paths,['p/photo.jpg']);
  for(const path of ['/storage/v1/object/project-photos/a.jpg','/storage/v1/object/copy',
    '/storage/v1/object/move','/storage/v1/bucket','/storage/v1/object/sign/unknown/a.pdf'])
    assert.throws(()=>readRequest({path,method:'POST',body:{expiresIn:60}}));
  assert.throws(()=>readRequest({path:'/storage/v1/object/sign/project-photos',method:'POST',body:{expiresIn:60,paths:['../secret']}}));
});
