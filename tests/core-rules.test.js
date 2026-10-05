import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadScript(path, extra={}) {
  const context={console, ...extra};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
  return context;
}

test('certificate award codes remain stable',()=>{
  const c=loadScript('js/tournament/certificate-rules.js');
  assert.equal(c.window.SCMSCertificateRules.awardCode('1st Place'),'1ST');
  assert.equal(c.window.SCMSCertificateRules.awardCode('2nd Place'),'2ND');
  assert.equal(c.window.SCMSCertificateRules.awardCode('3rd Place'),'3RD');
  assert.equal(c.window.SCMSCertificateRules.awardCode('Most Improved'),'MIP');
  assert.equal(c.window.SCMSCertificateRules.awardCode('Strategic Player'),'SP');
  assert.equal(c.window.SCMSCertificateRules.awardCode('Fighting Spirit'),'FS');
});

test('certificate captions and numbers remain deterministic',()=>{
  const c=loadScript('js/tournament/certificate-rules.js');
  const rules=c.window.SCMSCertificateRules;
  assert.equal(rules.awardCaption('1st Place','Monthly Tournament'),'1st in Monthly Tournament');
  assert.equal(rules.certificateNumber({event_date:'2026-10-05',tournament_id:'12345678-abcd'}, {award_type:'1st Place'}),'BSA-2026-12345678-1ST');
});

test('shared runtime helpers behave predictably',()=>{
  const c=loadScript('js/core/runtime.js');
  const r=c.window.SCMSRuntime;
  assert.equal(r.escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(r.safeNumber('42'),42);
  assert.equal(r.safeNumber('bad',7),7);
});
