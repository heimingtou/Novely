import test from 'node:test';
import assert from 'node:assert/strict';
import {target,verifyIdentity,verifyEmpty} from '../scripts/staging.mjs';
const config={projectRef:'abcdefghijklmnopqrst',productionProjectRef:'zyxwvutsrqponmlkjihg',host:'aws-1-ap-northeast-1.pooler.supabase.com',port:5432,user:'postgres.abcdefghijklmnopqrst',database:'postgres'};
const identity={db:'postgres',role:'postgres',version:'17.12 (test build)',version_num:170012,ref:config.projectRef};
test('session pooler routing user is distinct from PostgreSQL current_user',()=>{
  assert.equal(target(config),'https://abcdefghijklmnopqrst.supabase.co');
  assert.equal(verifyIdentity(identity,config).role,'postgres');
});
for(const [change,expected] of [
  [{db:'other_database'},'DATABASE_MISMATCH'],
  [{role:'other_role'},'CURRENT_USER_MISMATCH'],
  [{version:'17.6',version_num:170006},'POSTGRES_VERSION_MISMATCH'],
  [{ref:'differentprojectrefxx'},'PROJECT_REF_MISMATCH'],
])test('reports exact gate '+expected,()=>assert.throws(()=>verifyIdentity({...identity,...change},config),e=>{
  assert.equal(e.gate,expected);assert.equal(e.code,'STAGING_PREFLIGHT_GATE');
  assert.ok(!Object.hasOwn(e.diagnostics,'password'));return true;
}));
test('missing optional server project setting does not replace host/user target validation',()=>{
  assert.equal(verifyIdentity({...identity,ref:null},config).projectRefReported,false);
  assert.throws(()=>target({...config,user:'postgres.otherprojectrefxxxxxx'}));
});
test('version number rejects wrong patch regardless of display string',()=>{
  assert.throws(()=>verifyIdentity({...identity,version_num:170013},config),e=>e.gate==='POSTGRES_VERSION_MISMATCH');
  assert.equal(verifyIdentity({...identity,version:'17.12-custom'},config).versionNumber,170012);
});
test('public schema gate reports counts and never accepts existing functions/types',()=>{
  verifyEmpty({relations:0,functions:0,types:0});
  assert.throws(()=>verifyEmpty({relations:0,functions:2,types:0}),e=>e.gate==='PUBLIC_SCHEMA_NOT_EMPTY'&&e.diagnostics.functions===2);
});
const bodyHash='a'.repeat(64);
const infrastructure={name:'rls_auto_enable',arguments:'',result:'event_trigger',owner:'postgres',
  security_definer:true,language:'plpgsql',extension:null,settings:['search_path=pg_catalog'],body_hash:bodyHash,
  event_triggers:[{name:'ensure_rls',owner:'postgres',event:'ddl_command_end',enabled:'O',tags:['SELECT INTO','CREATE TABLE','CREATE TABLE AS']}]};
test('only explicitly reviewed RLS infrastructure is excluded from business objects',()=>{
  verifyEmpty({relations:0,functions:1,types:0},[infrastructure],bodyHash);
});
test('a familiar function name never bypasses definition review',()=>{
  assert.throws(()=>verifyEmpty({relations:0,functions:1,types:0},[infrastructure]),e=>e.gate==='PLATFORM_FUNCTION_REVIEW_REQUIRED');
});
test('changed infrastructure body hash blocks preflight',()=>{
  assert.throws(()=>verifyEmpty({relations:0,functions:1,types:0},[infrastructure],'b'.repeat(64)),e=>e.gate==='PLATFORM_FUNCTION_REVIEW_REQUIRED');
});
test('wrong function shape, search path or event binding stays blocked',()=>{
  for(const change of [{name:'other'}, {result:'trigger'}, {owner:'anon'}, {settings:null},
    {security_definer:false}, {event_triggers:[]}, {event_triggers:[{...infrastructure.event_triggers[0],tags:null}]}]) {
    assert.throws(()=>verifyEmpty({relations:0,functions:1,types:0},[{...infrastructure,...change}],bodyHash),e=>e.gate==='PUBLIC_SCHEMA_NOT_EMPTY');
  }
});
test('reviewed infrastructure cannot hide tables or other routines',()=>{
  for(const counts of [{relations:1,functions:1,types:0},{relations:0,functions:2,types:0}])
    assert.throws(()=>verifyEmpty(counts,[infrastructure],bodyHash),e=>e.gate==='PUBLIC_SCHEMA_NOT_EMPTY');
});
