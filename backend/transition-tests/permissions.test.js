import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { openRestore, catalog, dataSignatures } from '../scripts/lib/restore-target.js';

test('permission hardening with broad defaults in a rolled-back isolated schema', async (t) => {
  const { pool, client } = await openRestore();
  const schema = 'be024_acl_' + randomBytes(5).toString('hex');
  const roles = ['anon','authenticated','service_role'].map(name => schema+'_'+name);
  const before = await catalog(client);
  const signatures = await dataSignatures(client,before.columns);
  const defaults = (await client.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows;
  let checks=0;
  const check = async (name, work) => t.test(name, async () => { await work(); checks++; });
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    for (const [i,role] of roles.entries()) await client.query(`CREATE ROLE ${role} NOLOGIN ${i===2?'BYPASSRLS':'NOBYPASSRLS'}`);
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${roles.join(',')}`);
    for (const kind of ['TABLES','SEQUENCES','FUNCTIONS']) {
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON ${kind} TO ${roles.join(',')}`);
    }
    await client.query(`CREATE TABLE ${schema}.users(user_id integer PRIMARY KEY);
      CREATE TABLE ${schema}.chapters(chapter_id integer PRIMARY KEY,content text NOT NULL DEFAULT '');
      CREATE TABLE ${schema}.chapter_contents(chapter_id integer PRIMARY KEY REFERENCES ${schema}.chapters ON DELETE CASCADE,content text NOT NULL);
      CREATE TABLE ${schema}.bookshelves(updated_at timestamptz);
      CREATE TABLE ${schema}.reviews(updated_at timestamptz);
      CREATE FUNCTION ${schema}.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;`);
    const sql=await readFile(new URL('../../database/migrations/20261125_01_expand_legacy.sql',import.meta.url),'utf8');
    const local = value => value.replaceAll('public.',schema+'.').replaceAll("n.nspname='public'",`n.nspname='${schema}'`)
      .replaceAll("('anon','authenticated','service_role')",`('${roles[0]}','${roles[1]}','${roles[2]}')`);
    await client.query(local(sql.slice(sql.indexOf('CREATE TABLE public.forum_category'),sql.indexOf('-- Expand only'))));
    await client.query(local(sql.slice(sql.indexOf('CREATE FUNCTION public.novely_sync_legacy_content'),sql.indexOf('-- Reuse exact'))));
    await check('broad audit-like defaults really grant TRUNCATE and sequence/function rights',async()=>{
      assert.equal((await client.query(`SELECT has_table_privilege($1,'${schema}.forum_post','TRUNCATE') AS allowed`,[roles[0]])).rows[0].allowed,true);
      assert.equal((await client.query(`SELECT has_sequence_privilege($1,'${schema}.forum_post_post_id_seq','UPDATE') AS allowed`,[roles[1]])).rows[0].allowed,true);
      assert.equal((await client.query(`SELECT has_function_privilege($1,'${schema}.novely_sync_legacy_content()','EXECUTE') AS allowed`,[roles[2]])).rows[0].allowed,true);
    });
    const defaultBefore=(await client.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows;
    await client.query(local(sql.split('-- BEGIN NEW OBJECT ACL HARDENING')[1].split('-- END NEW OBJECT ACL HARDENING')[0]));
    await check('all eleven objects have owner-only ACLs including PUBLIC removal',async()=>{
      const audit=await readFile(new URL('../../database/checks/new-object-permissions.sql',import.meta.url),'utf8');
      const rows=(await client.query(audit.replaceAll("'public'::regnamespace",`'${schema}'::regnamespace`))).rows;
      assert.equal(rows.length,11);assert.ok(rows.every(row=>row.non_owner_grants===0));
    });
    await check('default privileges unchanged by hardening',async()=>assert.deepEqual((await client.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows,defaultBefore));
    await check('all five Forum tables retain RLS without policies',async()=>{
      const rows=(await client.query(`SELECT relrowsecurity FROM pg_class WHERE relnamespace=$1::regnamespace AND relname LIKE 'forum_%' AND relkind='r'`,[schema])).rows;
      assert.equal(rows.length,5);assert.ok(rows.every(r=>r.relrowsecurity));
    });
    for (const role of roles) await check('Forum/sequence/function access denied for '+role.slice(schema.length+1),async()=>{
      for (const query of [`SELECT * FROM ${schema}.forum_post`,`INSERT INTO ${schema}.forum_category(name) VALUES('synthetic')`,`TRUNCATE ${schema}.forum_post`,`SELECT nextval('${schema}.forum_post_post_id_seq')`,`SELECT ${schema}.novely_sync_legacy_content()`]) {
        await client.query('SAVEPOINT denied');
        await client.query(`SET LOCAL ROLE ${role}`);
        await assert.rejects(client.query(query),error=>error.code==='42501');
        await client.query('ROLLBACK TO SAVEPOINT denied');
        await client.query('RELEASE SAVEPOINT denied');
      }
    });
    await check('Writer invoker triggers work without application EXECUTE grants',async()=>{
      await client.query(`INSERT INTO ${schema}.chapters(chapter_id) VALUES(1);
        SET LOCAL ROLE ${roles[2]};
        INSERT INTO ${schema}.chapter_contents VALUES(1,'synthetic old Writer');
        INSERT INTO ${schema}.chapter_contents VALUES(1,'synthetic upsert') ON CONFLICT(chapter_id) DO UPDATE SET content=EXCLUDED.content;`);
      assert.equal((await client.query(`SELECT content FROM ${schema}.chapters WHERE chapter_id=1`)).rows[0].content,'synthetic upsert');
      await client.query(`UPDATE ${schema}.chapters SET content='synthetic new content' WHERE chapter_id=1`);
      assert.equal((await client.query(`SELECT content FROM ${schema}.chapter_contents WHERE chapter_id=1`)).rows[0].content,'synthetic new content');
      await client.query(`DELETE FROM ${schema}.chapter_contents WHERE chapter_id=1`);
      assert.equal((await client.query(`SELECT content FROM ${schema}.chapters WHERE chapter_id=1`)).rows[0].content,'');
      await client.query('RESET ROLE');
    });
  } catch (error) { throw new Error('Isolated ACL check failed: '+(error.code||error.name)); }
  finally {
    await client.query('ROLLBACK');
    try {
      assert.deepEqual(await catalog(client),before);
      assert.deepEqual(await dataSignatures(client,before.columns),signatures);
      assert.deepEqual((await client.query('SELECT * FROM pg_default_acl ORDER BY oid')).rows,defaults);
      assert.equal((await client.query('SELECT count(*)::integer AS n FROM pg_roles WHERE rolname=ANY($1)',[roles])).rows[0].n,0);
    } finally { client.release();await pool.end(); }
  }
  assert.equal(checks,8);
});
