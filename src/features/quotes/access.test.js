import test from 'node:test';
import assert from 'node:assert/strict';
import { canUseQuotes } from './access.js';
test('quotation rollout is visible only to Bar and Peleg, never other administrators or managers',()=>{
  assert.equal(canUseQuotes('8b93c4e8-df14-4eb5-b2fc-b6ace307cb94'),true);
  assert.equal(canUseQuotes('c03434ca-a07e-4040-a431-69fbfffb3c75'),true);
  for(const value of [undefined,null,'','manager','admin','a7dae3e5-b6a9-4340-bac9-c3874b0b05e2','1d39a498-1a9d-4a31-9d3a-afeb511a0d39'])assert.equal(canUseQuotes(value),false);
});
