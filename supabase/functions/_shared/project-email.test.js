import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderProjectEmail,highlightBlock,noteBlock} from './project-email.ts';
import {getStatusEmailTheme} from './status-email-theme.ts';
const options={theme:getStatusEmailTheme('הושלם'),title:'Report',projectName:'Project',clientName:'Client',location:'Site',appUrl:'https://example.com'};
test('existing project mails retain the Hebrew status-email card by default',()=>{
 const html=renderProjectEmail(options);
 for(const value of ['MAYA TRACKER','max-width:640px','background:#0b2a55','background:#eef4fa','כל הפרטים החשובים, במקום אחד','פתיחת הפרויקט במערכת'])assert.ok(html.includes(value));
 assert.match(html,/lang="he" dir="rtl"/);
});
test('English and Greek cards localize every shared label and use LTR alignment',()=>{
 for(const language of ['en','el']){
  const html=renderProjectEmail({...options,language});
  assert.doesNotMatch(html,/[א-ת]/);assert.match(html,new RegExp(`lang="${language}" dir="ltr"`));
  assert.match(html,/text-align:left/);
 }
});
test('shared card escapes content and directional callouts support both layouts',()=>{
 const html=renderProjectEmail({...options,title:'<script>bad</script>',projectName:'A & B'});
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/A &amp; B/);
 assert.match(highlightBlock(options.theme,'Ready','ltr'),/border-left:5px/);
 assert.match(highlightBlock(options.theme,'Ready'),/border-right:5px/);
 assert.match(noteBlock('A < B','<strong>Ready</strong>'),/A &lt; B/);
});
