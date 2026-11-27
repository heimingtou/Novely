import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {target,sanitize} from '../scripts/staging.mjs';
import {openRestore,catalog,dataSignatures} from '../scripts/lib/restore-target.js';
import {createRequire} from 'node:module';
test('real SDK preserves permission SQLSTATE with GET limit zero',async()=>{
  const require=createRequire(new URL('../../package.json',import.meta.url));
  const {createClient}=require('@supabase/supabase-js');
  const api=createClient('http://127.0.0.1:1','synthetic-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,options)=>{
    assert.equal(options.method,'GET');assert.equal(new URL(url).searchParams.get('limit'),'0');
    return new Response(JSON.stringify({code:'42501',message:'Synthetic denial'}),{status:403,headers:{'Content-Type':'application/json'}});
  }}});
  assert.equal((await api.from('forum_post').select('*').limit(0)).error.code,'42501');
});
test('staging target guards reject production, mismatches and transaction poolers',()=>{
  const base={projectRef:'abcdefghijklmnopqrst',productionProjectRef:'zyxwvutsrqponmlkjihg',host:'db.abcdefghijklmnopqrst.supabase.co',user:'postgres',database:'postgres',port:5432};
  assert.equal(target(base),'https://abcdefghijklmnopqrst.supabase.co');
  for(const bad of [{...base,projectRef:base.productionProjectRef},{...base,host:'db.wrong.supabase.co'},{...base,port:6543},{...base,projectRef:'sctbtzvlzrhrhqveceln',host:'db.sctbtzvlzrhrhqveceln.supabase.co'}])assert.throws(()=>target(bad));
});
test('schema-only backup plus synthetic fixture can migrate/rollback in an isolated Local schema',async()=>{
  const {pool,client}=await openRestore();
  const before=await catalog(client),signatures=await dataSignatures(client,before.columns);
  const schema='staging_rehearsal_'+Date.now();
  const local=sql=>sql.replace(/\bpublic\b/g,schema);
  try {
    const ddl=sanitize(await fs.readFile(new URL('../.local/staging/legacy.raw.sql',import.meta.url),'utf8'));
    const fixture=await fs.readFile(new URL('../../database/tests/staging-legacy-fixture.sql',import.meta.url),'utf8');
    const migration=await fs.readFile(new URL('../../database/migrations/20261125_01_expand_legacy.sql',import.meta.url),'utf8');
    const fingerprint=local(await fs.readFile(new URL('../../database/checks/legacy-data-fingerprint.sql',import.meta.url),'utf8'));
    await client.query('BEGIN');await client.query(`CREATE SCHEMA ${schema};SET LOCAL search_path=${schema},pg_catalog;SET LOCAL check_function_bodies=false`);
    await client.query(local(ddl));await client.query(local(fixture));
    assert.equal((await client.query('SELECT count(*)::integer AS n FROM pg_indexes WHERE schemaname=$1',[schema])).rows[0].n,38);
    const legacy=(await client.query(fingerprint)).rows;
    for(let i=0;i<2;i++) {
      await client.query('SAVEPOINT rehearsal');await client.query(local(migration));
      assert.equal((await client.query('SELECT count(*)::integer AS n FROM pg_indexes WHERE schemaname=$1',[schema])).rows[0].n,70);
      assert.deepEqual((await client.query(fingerprint)).rows,legacy);
      const acl=local(await fs.readFile(new URL('../../database/checks/new-object-permissions.sql',import.meta.url),'utf8'));
      const rows=(await client.query(acl)).rows;assert.equal(rows.length,11);assert.ok(rows.every(x=>x.non_owner_grants===0));
      await client.query('ROLLBACK TO SAVEPOINT rehearsal');await client.query('RELEASE SAVEPOINT rehearsal');
      assert.deepEqual((await client.query(fingerprint)).rows,legacy);
    }
  } catch(e) {throw new Error('Local staging rehearsal failed: '+(e.code||e.name));}
  finally {
    await client.query('ROLLBACK');
    try {assert.deepEqual(await catalog(client),before);assert.deepEqual(await dataSignatures(client,before.columns),signatures);}
    finally {client.release();await pool.end();}
  }
});
