import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=path.join(root,'backend/.local/staging');
const configPath=path.join(out,'config.json');
const ddlPath=path.join(out,'legacy.schema.sql');
const migrationPath=path.join(root,'database/migrations/20261125_01_expand_legacy.sql');
const hash=x=>createHash('sha256').update(x).digest('hex');
let checkpoint='offline';
let diagnostics={};
function gate(condition,name,details={}) {
  if(!condition) {const error=new Error(name);error.code='STAGING_PREFLIGHT_GATE';error.gate=name;error.diagnostics=details;throw error;}
}
export function verifyIdentity(r,c) {
  const observed={database:r.db,role:r.role,version:String(r.version).match(/^\d+(?:\.\d+){1,2}/)?.[0]??'unrecognized',
    versionNumber:r.version_num,projectRefReported:Boolean(r.ref),projectRefMatches:r.ref? r.ref===c.projectRef:null};
  gate(r.db==='postgres','DATABASE_MISMATCH',observed);
  gate(r.role==='postgres','CURRENT_USER_MISMATCH',observed);
  gate(r.version_num===170012,'POSTGRES_VERSION_MISMATCH',observed);
  gate(!r.ref||r.ref===c.projectRef,'PROJECT_REF_MISMATCH',observed);
  return observed;
}
export function verifyEmpty(counts,functions=[],reviewedHash) {
  gate(counts.relations===0&&counts.types===0,'PUBLIC_SCHEMA_NOT_EMPTY',counts);
  if(counts.functions===0)return;
  const f=functions[0],binding=f?.event_triggers?.[0];
  const platform=counts.functions===1&&functions.length===1&&f.name==='rls_auto_enable'
    &&f.arguments===''&&f.result==='event_trigger'&&f.owner==='postgres'
    &&f.security_definer===true&&f.language==='plpgsql'&&f.extension===null
    &&JSON.stringify(f.settings)===JSON.stringify(['search_path=pg_catalog'])
    &&f.event_triggers?.length===1&&binding.name==='ensure_rls'&&binding.owner==='postgres'
    &&binding.event==='ddl_command_end'&&binding.enabled==='O'&&Array.isArray(binding.tags)
    &&JSON.stringify([...binding.tags].sort())===JSON.stringify(['CREATE TABLE','CREATE TABLE AS','SELECT INTO']);
  gate(platform,'PUBLIC_SCHEMA_NOT_EMPTY',counts);
  gate(/^[a-f0-9]{64}$/.test(reviewedHash||'')&&reviewedHash===f.body_hash,
    'PLATFORM_FUNCTION_REVIEW_REQUIRED',{name:f.name,bodyHash:f.body_hash});
}
const read=name=>fs.readFile(path.join(root,name),'utf8');
// Independent deny-list for the production project previously identified in this workspace.
const productionHash=hash('sctbtzvlzrhrhqveceln');
export function target(c) {
  assert.match(c.projectRef,/^[a-z]{20}$/);
  assert.match(c.productionProjectRef,/^[a-z]{20}$/);
  assert.notEqual(c.projectRef,c.productionProjectRef);
  assert.notEqual(hash(c.projectRef),productionHash,'Production target forbidden');
  assert.equal(c.database,'postgres');assert.equal(c.port,5432);
  const direct=c.host===`db.${c.projectRef}.supabase.co` && c.user==='postgres';
  const session=/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(c.host) && c.user===`postgres.${c.projectRef}`;
  assert.ok(direct||session,'Only project-bound direct/session connections allowed');
  return `https://${c.projectRef}.supabase.co`;
}
export function sanitize(sql) {
  assert.equal((sql.match(/^CREATE TABLE public\./gm)||[]).length,16);
  assert.equal((sql.match(/^CREATE FUNCTION public\./gm)||[]).length,6);
  assert.equal((sql.match(/^CREATE TRIGGER /gm)||[]).length,8);
  assert.ok(!/^\s*(COPY .* FROM stdin|INSERT INTO|SELECT .*setval\()/im.test(sql));
  const clean=sql.split(/\r?\n/).filter(line=> !/^\\(?:un)?restrict\b/.test(line)
    && !/^SET /.test(line) && !/^CREATE SCHEMA public;/.test(line)
    && !/^SELECT pg_catalog\.set_config\('search_path'/.test(line)
    && !/^ALTER TABLE .* SET \(pg_attver=\d+\);$/.test(line)).join('\n');
  assert.ok(!/^\\/m.test(clean));
  assert.ok(!/OWNER TO|^GRANT |^REVOKE |pg_attver|transaction_timeout/m.test(clean));
  return clean;
}
async function prepare() {
  await fs.mkdir(out,{recursive:true});
  const raw=path.join(out,'legacy.raw.sql');
  const args=['--schema-only','--schema=public','--no-owner','--no-privileges',`--file=${raw}`,
    'C:/Novely_Backups/novely_20261125_204719.dump'];
  const r=spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_restore.exe',args,{windowsHide:true,encoding:'utf8'});
  assert.equal(r.status,0,'Schema-only extraction failed');
  const ddl=sanitize(await fs.readFile(raw,'utf8'));await fs.writeFile(ddlPath,ddl);
  try { await fs.writeFile(configPath,JSON.stringify({projectRef:'FILL_STAGING_REF',productionProjectRef:'FILL_PRODUCTION_REF',host:'db.FILL_STAGING_REF.supabase.co',port:5432,user:'postgres',database:'postgres'},null,2)+'\n',{flag:'wx'}); } catch(e) { if(e.code!=='EEXIST')throw e; }
  return {tables:16,functions:6,triggers:8,tableData:false,schemaHash:hash(ddl)};
}
async function identity(db,c) {
  const {rows:[r]}=await db.query("SELECT current_database() AS db,current_user AS role,current_setting('server_version') AS version,current_setting('server_version_num')::integer AS version_num,current_setting('supabase.project_ref',true) AS ref");
  diagnostics.identity=verifyIdentity(r,c);
  return r;
}
async function objects(db,c) {
  const counts={relations:(await db.query("SELECT count(*)::integer AS n FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','v','m','S','f','c')")).rows[0].n,
    functions:(await db.query("SELECT count(*)::integer AS n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n,
    types:(await db.query("SELECT count(*)::integer AS n FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype IN ('e','d')")).rows[0].n};
  diagnostics.publicObjects=counts;
  if(counts.functions>0) diagnostics.publicFunctions=(await db.query(`SELECT p.proname AS name,
    pg_get_function_identity_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
    pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,l.lanname AS language,
    e.extname AS extension,p.proconfig AS settings,
    encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_hash,
    md5(COALESCE(p.proacl::text,'')) AS acl_hash,
    COALESCE((SELECT json_agg(json_build_object('name',et.evtname,'event',et.evtevent,
      'enabled',et.evtenabled,'tags',et.evttags,'owner',pg_get_userbyid(et.evtowner)) ORDER BY et.evtname)
      FROM pg_event_trigger et WHERE et.evtfoid=p.oid),'[]'::json) AS event_triggers
    FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    LEFT JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
    LEFT JOIN pg_extension e ON e.oid=d.refobjid
    WHERE p.pronamespace='public'::regnamespace ORDER BY p.proname,p.oid LIMIT 30`)).rows;
  verifyEmpty(counts,diagnostics.publicFunctions,c.reviewedPlatformFunctionHash);
  diagnostics.reviewedInfrastructureFunctions=counts.functions;
  return 0;
}
async function fingerprint(db) { return (await db.query(await read('database/checks/legacy-data-fingerprint.sql'))).rows; }
async function catalog(db) {return (await db.query(await read('backend/scripts/sql/catalog-snapshot.sql'))).rows[0].catalog;}
async function validate(db) {
  const results=await db.query(await read('database/checks/migration-postflight.sql'));
  assert.equal(results[0].rows[0].tables,21);assert.equal(results[0].rows[0].indexes,70);
  assert.equal(results[0].rows[0].triggers,14);assert.equal(results[0].rows[0].trigger_functions,7);
  for(const [k,v] of Object.entries(results[1].rows[0]))if(k!=='audit')assert.equal(v,0);
  const a=(await db.query(await read('database/checks/new-object-permissions.sql'))).rows;
  assert.equal(a.length,11);assert.ok(a.every(x=>x.non_owner_grants===0));
  await db.query(await read('database/checks/supabase-access-audit.sql'));
  await db.query('SAVEPOINT compatibility');
  await db.query(await read('database/tests/be02_4-compatibility.sql'));
  await db.query('ROLLBACK TO SAVEPOINT compatibility');await db.query('RELEASE SAVEPOINT compatibility');
}
async function cloud(phase,c) {
  checkpoint='target-config';
  gate(process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0','TLS_BYPASS_FORBIDDEN');
  target(c);
  diagnostics={connectionMode:c.host.endsWith('.pooler.supabase.com')?'session-pooler':'direct',port:c.port,
    tls:{rejectUnauthorized:true,extraCaConfigured:Boolean(process.env.NODE_EXTRA_CA_CERTS)}};
  checkpoint='password';gate(Boolean(process.env.NOVELY_STAGING_DB_PASSWORD),'PASSWORD_REQUIRED');
  const db=new pg.Client({host:c.host,port:c.port,user:c.user,database:c.database,
    password:process.env.NOVELY_STAGING_DB_PASSWORD,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:10000,
    application_name:'novely-staging-verification',options:'-c timezone=UTC -c statement_timeout=60000'});
  checkpoint='tls-connect';db.on('error',()=>{});
  try {
    try {await db.connect();} catch(error) {
      diagnostics.tls.authorized=db.connection.stream?.authorized===true;
      if(['28P01','28000'].includes(error.code))checkpoint='authentication';
      throw error;
    }
    diagnostics.tls.authorized=db.connection.stream.authorized===true;
    gate(diagnostics.tls.authorized,'TLS_NOT_AUTHORIZED',diagnostics.tls);
    checkpoint='identity-metadata';const id=await identity(db,c);
    if(phase==='preflight') {await db.query('BEGIN READ ONLY');checkpoint='empty-public-schema';await objects(db,c);return {version:id.version,businessSchemaEmpty:true,diagnostics};}
    // Smoke is explicitly requested by its phase; it does not apply migration SQL.
    if(phase==='smoke') {checkpoint='smoke-setup';return await smoke(db,c);}
    checkpoint='action-approval';
    assert.equal(process.env.NOVELY_STAGING_APPROVAL,`${phase.toUpperCase()} ${c.projectRef}`,'Explicit approval missing');
    const ddl=await fs.readFile(ddlPath,'utf8'),migration=await fs.readFile(migrationPath,'utf8');
    assert.equal(sanitize(ddl),ddl,'Only verified schema-only SQL may be uploaded');
    const fixture=await read('database/tests/staging-legacy-fixture.sql');
    const stamp={project:hash(c.projectRef),schema:hash(ddl),migration:hash(migration),fixture:hash(fixture)};
    await db.query('BEGIN');await db.query("SET LOCAL search_path=public,pg_catalog; SET LOCAL lock_timeout='5s'");
    if(phase==='init') {
      checkpoint='empty-schema-and-legacy-init';
      assert.equal(await objects(db,c),0,'Public schema is not empty');
      await db.query('SET LOCAL check_function_bodies=false');await db.query(ddl);
      await db.query('SET LOCAL search_path=public,pg_catalog');
      for(const kind of ['TABLES','SEQUENCES','FUNCTIONS']) {
        if(kind==='FUNCTIONS') await db.query(`GRANT EXECUTE ON FUNCTION public.recalc_counters(),public.set_updated_at(),public.trg_chapter_likes_count(),public.trg_comments_count(),public.trg_follows_count(),public.trg_novel_likes_count() TO anon,authenticated,service_role`);
        else await db.query(`GRANT ALL PRIVILEGES ON ALL ${kind} IN SCHEMA public TO anon,authenticated,service_role`);
        await db.query(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON ${kind} TO anon,authenticated,service_role`);
      }
      await db.query(fixture);
      if(diagnostics.reviewedInfrastructureFunctions===1) {
        const saved=diagnostics.publicFunctions[0];
        const {rows:[after]}=await db.query(`SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') AS body_hash,
          md5(COALESCE(proacl::text,'')) AS acl_hash FROM pg_proc
          WHERE pronamespace='public'::regnamespace AND proname='rls_auto_enable' AND pronargs=0`);
        gate(after?.body_hash===saved.body_hash&&after?.acl_hash===saved.acl_hash,'PLATFORM_FUNCTION_CHANGED');
      }
      const p=(await db.query(await read('database/checks/legacy-preflight.sql'))).rows[0];
      assert.ok(p.legacy_16_tables&&p.content_not_added&&p.scoped_timestamp_trigger);
      assert.equal(p.indexes,38);assert.equal(p.triggers,8);assert.equal(p.legacy_functions,6);
      assert.equal(p.missing_contents+p.cross_chapter_parents,0);
      await db.query('COMMIT');return {initialized:true,tables:16,syntheticOnly:true};
    }
    assert.ok(['dry-run','apply'].includes(phase));
    await db.query(`LOCK TABLE public.bookshelves,public.chapter_contents,public.chapter_likes,public.chapters,public.comments,public.follows,public.genres,public.interact_novel,public.interact_novel_day,public.novel_genres,public.novel_likes,public.novels,public.profiles,public.reading_progress,public.reviews,public.users IN ACCESS EXCLUSIVE MODE`);
    const before=await fingerprint(db),beforeCatalog=await catalog(db);
    if(phase==='apply') {
      const receipt=JSON.parse(await fs.readFile(path.join(out,'dry-run.receipt.json'),'utf8'));
      assert.deepEqual(receipt.stamp,stamp);assert.deepEqual(receipt.before,before);
    }
    checkpoint='migration';await db.query(migration);checkpoint='postflight';await validate(db);assert.deepEqual(await fingerprint(db),before);
    const after=await catalog(db);
    for(const key of ['constraints','indexes','functions','grants','policies'])for(const item of beforeCatalog[key])
      assert.ok(after[key].some(x=>JSON.stringify(x)===JSON.stringify(item)),`Legacy ${key} changed`);
    assert.deepEqual(after.sequences.filter(x=>beforeCatalog.sequences.some(y=>x.sequencename===y.sequencename)),beforeCatalog.sequences);
    await db.query(phase==='apply'?'COMMIT':'ROLLBACK');
    if(phase==='dry-run') {
      assert.deepEqual(await fingerprint(db),before);assert.deepEqual(await catalog(db),beforeCatalog);
      await fs.writeFile(path.join(out,'dry-run.receipt.json'),JSON.stringify({stamp,before})+'\n');
    }
    return {tables:21,dataPreserved:true,permissions:true,rollback:phase==='dry-run',applied:phase==='apply'};
  } finally {await db.query('ROLLBACK').catch(()=>{});await db.end();}
}
async function smoke(db,c) {
  const {createRequire}=await import('node:module');const require=createRequire(path.join(root,'package.json'));
  const {createClient}=require('@supabase/supabase-js');
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin=createClient(target(c),process.env.NOVELY_STAGING_SERVICE_KEY,options);
  const anon=createClient(target(c),process.env.NOVELY_STAGING_PUBLIC_KEY,options);
  const run=async query=>{const r=await query;assert.equal(r.error,null);return r.data;};
  const before=await fingerprint(db);const marker='be024-smoke-'+randomUUID();let novel,chapter;
  const {registerHooks}=await import('node:module');
  const mocks=await import('../../tests/helpers/writer-server-mocks.mjs');mocks.setWriterTestClient(admin);
  const aliases=new Map([
    ['server-only','data:text/javascript,export%20%7B%7D'],
    ['@/lib/supabase/admin',new URL('../../tests/helpers/writer-server-mocks.mjs',import.meta.url).href],
    ['@/server/storage',new URL('../../tests/helpers/writer-server-mocks.mjs',import.meta.url).href],
    ...['http.js','presenters.js','retry-deadlock.mjs'].map(f=>['@/server/'+f.replace(/\.js$/,''),new URL('../../src/server/'+f,import.meta.url).href]),
  ]);
  const hook=registerHooks({resolve(s,ctx,next){return aliases.has(s)?{url:aliases.get(s),shortCircuit:true}:next(s,ctx);}});
  let writer;try {writer=await import('../../src/server/services/writer.js');}finally{hook.deregister();}
  const writerCall=async action=>{const saved=console.error;console.error=()=>{};try{return await action();}finally{console.error=saved;}};
  try {
    checkpoint='PostgREST-reader-relations';
    for(const select of ['novel_id,genres(genre_id),interact_novel(view),reviews(rating),bookshelves(count)',
      'novel_id,author:users!fk_novels_author(user_id,profile:profiles(avatar))'])await run(admin.from('novels').select(select).limit(1));
    await run(admin.from('follows').select('followed:users!fk_follows_follow(user_id)').limit(1));
    await run(admin.from('reviews').select('review_id,novel:novels(title,slug,published)').limit(1));
    await run(admin.from('novels').select('novel_id,chapters(chapter_id),interact_novel(view)').limit(1));
    await run(admin.from('comments').select('comment_id,parent_id,chapter_id').limit(1));
    checkpoint='PostgREST-Writer-create-edit';
    const n=await run(admin.from('novels').insert({author_id:-250101,title:'Synthetic smoke novel',slug:marker}).select('novel_id').single());novel=n.novel_id;
    const user={id:-250101,role:'author'};
    chapter=await writerCall(()=>writer.saveChapter(user,novel,null,{title:'Synthetic smoke chapter',content:'Synthetic Writer create',publish:true}));
    await run(admin.from('chapters').select('chapter_id,chapter_contents(content)').eq('chapter_id',chapter).single());
    await writerCall(()=>writer.saveChapter(user,novel,chapter,{title:'Synthetic edited title',content:'Synthetic Writer edit',publish:true}));
    assert.equal((await run(admin.from('chapters').select('content').eq('chapter_id',chapter).single())).content,'Synthetic Writer edit');
    await db.query('UPDATE public.chapters SET content=$1 WHERE chapter_id=$2',['Synthetic SQL direction',chapter]);
    assert.equal((await run(admin.from('chapter_contents').select('content').eq('chapter_id',chapter).single())).content,'Synthetic SQL direction');
    const clients=[admin,anon];
    if(process.env.NOVELY_STAGING_USER_JWT) {
      const token=process.env.NOVELY_STAGING_USER_JWT,payload=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
      assert.equal(payload.iss,target(c)+'/auth/v1');assert.equal(payload.role,'authenticated');
      clients.push(createClient(target(c),process.env.NOVELY_STAGING_PUBLIC_KEY,{...options,global:{headers:{Authorization:'Bearer '+token}}}));
    }
    checkpoint='PostgREST-Forum-permissions';
    for(const api of clients)for(const table of ['forum_category','forum_post','forum_comment','forum_reaction','forum_report']) {
      // GET limit=0 keeps the error JSON/SQLSTATE; HEAD has no response body.
      const r=await api.from(table).select('*').limit(0);assert.equal(r.error?.code,'42501');
    }
    const rls=(await db.query("SELECT count(*)::integer AS n FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'forum_%' AND rowsecurity")).rows[0];assert.equal(rls.n,5);
    checkpoint='SQL-RLS-with-synthetic-rows';
    await db.query('BEGIN');
    try {
      await db.query(`INSERT INTO public.forum_category(category_id,name) OVERRIDING SYSTEM VALUE VALUES(-250701,'Synthetic RLS');
        INSERT INTO public.forum_post(post_id,user_id,category_id,title,content) OVERRIDING SYSTEM VALUE VALUES(-250801,-250101,-250701,'Synthetic RLS','Synthetic');
        INSERT INTO public.forum_comment(comment_id,post_id,user_id,content) OVERRIDING SYSTEM VALUE VALUES(-250901,-250801,-250102,'Synthetic');
        INSERT INTO public.forum_reaction(user_id,post_id) VALUES(-250102,-250801);
        INSERT INTO public.forum_report(report_id,user_id,post_id,reason) OVERRIDING SYSTEM VALUE VALUES(-251001,-250102,-250801,'Synthetic');
        GRANT SELECT ON public.forum_category,public.forum_post,public.forum_comment,public.forum_reaction,public.forum_report TO anon,authenticated`);
      for(const role of ['anon','authenticated']) {
        await db.query(`SET LOCAL ROLE ${role}`);
        for(const table of ['forum_category','forum_post','forum_comment','forum_reaction','forum_report'])
          assert.equal((await db.query(`SELECT count(*)::integer AS n FROM public.${table}`)).rows[0].n,0);
        await db.query('RESET ROLE');
      }
    } finally {await db.query('ROLLBACK');}
    const acl=(await db.query(await read('database/checks/new-object-permissions.sql'))).rows;
    assert.ok(acl.every(x=>x.non_owner_grants===0));
    checkpoint='PostgREST-Writer-delete';
    await run(admin.from('chapter_contents').delete().eq('chapter_id',chapter));
    assert.equal((await run(admin.from('chapters').select('content').eq('chapter_id',chapter).single())).content,'');
    await writerCall(()=>writer.deleteChapter(user,novel,chapter));chapter=null;
    await run(admin.from('novels').delete().eq('novel_id',novel));novel=null;
  } finally {
    await db.query('DELETE FROM public.novels WHERE slug=$1 AND author_id=-250101',[marker]);
    assert.deepEqual(await fingerprint(db),before,'Smoke cleanup/data mismatch');
  }
  return {sdk:true,reader:true,writer:true,sync:true,forumDenied:true,rls:true,cleanup:true,authenticatedHttp:process.env.NOVELY_STAGING_USER_JWT?'PASS':'NOT_TESTED_NO_USER_JWT'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const phase=process.argv[2];await fs.mkdir(out,{recursive:true});
  try {
    assert.ok(['prepare','preflight','init','dry-run','apply','smoke'].includes(phase));
    const result=phase==='prepare'?await prepare():await cloud(phase,JSON.parse(await fs.readFile(configPath,'utf8')));
    const status=result.authenticatedHttp==='NOT_TESTED_NO_USER_JWT'?'PARTIAL':'PASS';
    await fs.writeFile(path.join(out,phase+'.result.json'),JSON.stringify({status,...result},null,2)+'\n');
    console.log(`${phase}: ${status}; log backend/.local/staging/${phase}.result.json`);
    if(status==='PARTIAL')process.exitCode=2;
  } catch(e) {
    const code=/^[A-Z0-9_]+$/.test(e.code||'')?e.code:e.name;
    const hint=code==='SELF_SIGNED_CERT_IN_CHAIN'?'Set NODE_EXTRA_CA_CERTS to the trusted Dashboard CA before starting Node; keep certificate verification enabled.'
      :code==='28P01'?'Database password authentication failed. Verify the staging Session Pooler project/username and enter the raw staging database password, not an API key, without URL encoding or surrounding quotes.'
      :code==='28000'?'Database authorization rejected. Verify the staging connection role and project routing; do not weaken TLS.'
      :undefined;
    await fs.writeFile(path.join(out,phase+'.result.json'),JSON.stringify({status:'FAIL',checkpoint,code,gate:e.gate,diagnostics,observed:e.diagnostics,hint},null,2)+'\n');
    console.error(`${phase}: FAIL/BLOCKED at ${checkpoint}${e.gate?' / '+e.gate:''}; see backend/.local/staging/${phase}.result.json`);process.exitCode=1;
  }
}
