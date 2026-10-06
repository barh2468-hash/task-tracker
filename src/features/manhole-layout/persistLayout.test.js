import test from 'node:test';
import assert from 'node:assert/strict';
import { persistLayout } from './persistLayout.js';
const id='11111111-1111-4111-8111-111111111111';
const payload=()=>({id,userId:'22222222-2222-4222-8222-222222222222',fileName:'test.pdf',preview:'data:image/png;base64,YQ==',pdf:new Blob(['%PDF-1.7'],{type:'application/pdf'}),source:{version:1,draft:{projectId:'33333333-3333-4333-8333-333333333333',num:'01',date:'2026-10-04',shaft:[],cover:[],groups:[]},photos:[]}});
function fixture({insertError=null,committed=null,uploadFailure=0}={}) {
  let uploaded=0,removed=0;
  const client={storage:{from:()=>({upload:async (_path,_file,options)=>{assert.equal(options.upsert,false);uploaded++;return {error:uploaded===uploadFailure?{message:'Network error'}:null};},remove:async paths=>{removed=paths.length;return {error:null};}})},from:()=>({insert:row=>({select:()=>({single:async()=>({data:insertError?null:row,error:insertError})})}),select:()=>({eq:()=>({maybeSingle:async()=>({data:committed,error:null})})})})};
  return {client,uploaded:()=>uploaded,removed:()=>removed};
}
test('an uncertain insert never removes files that may be referenced by a pending commit',async()=>{
  const f=fixture({insertError:{message:'Request timed out',code:''}});
  await assert.rejects(persistLayout(f.client,payload()),/לא ניתן לאשר/);
  assert.equal(f.uploaded(),3);assert.equal(f.removed(),0);
});
test('a lost insert response recovers the committed record without uploading a new version',async()=>{
  const f=fixture({insertError:{message:'Request timed out'},committed:{id}});
  assert.deepEqual(await persistLayout(f.client,payload()),{id});assert.equal(f.removed(),0);
});
test('an incomplete upload and a definitive constraint failure clean up only their incomplete files',async()=>{
  const partial=fixture({uploadFailure:2});await assert.rejects(persistLayout(partial.client,payload()));assert.equal(partial.removed(),3);
  const denied=fixture({insertError:{code:'42501'}});await assert.rejects(persistLayout(denied.client,payload()),/אין הרשאה/);assert.equal(denied.removed(),3);
});
