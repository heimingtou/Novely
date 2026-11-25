-- Read-only metadata. No user rows, credentials, DDL or sequence advancement.
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity
  ) ORDER BY c.relname) FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')),
  'columns', (SELECT jsonb_agg(jsonb_build_object(
    'table',c.relname,'name',a.attname,'position',a.attnum,
    'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
    'notNull',a.attnotnull,'identity',a.attidentity,
    'generated',a.attgenerated,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)
  ) ORDER BY c.relname,a.attnum) FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c ON c.oid=a.attrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT jsonb_agg(jsonb_build_object(
    'table',c.relname,'name',x.conname,'type',x.contype,
    'definition',pg_catalog.pg_get_constraintdef(x.oid,true),'validated',x.convalidated,
    'deferrable',x.condeferrable,'deferred',x.condeferred,
    'deleteAction',x.confdeltype,'updateAction',x.confupdtype,'deleteSetColumns',x.confdelsetcols
  ) ORDER BY c.relname,x.conname) FROM pg_catalog.pg_constraint x
    JOIN pg_catalog.pg_class c ON c.oid=x.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
  'indexes', (SELECT jsonb_agg(jsonb_build_object(
    'table',t.relname,'name',c.relname,'definition',pg_catalog.pg_get_indexdef(i.indexrelid),
    'valid',i.indisvalid,'ready',i.indisready
  ) ORDER BY t.relname,c.relname) FROM pg_catalog.pg_index i
    JOIN pg_catalog.pg_class c ON c.oid=i.indexrelid
    JOIN pg_catalog.pg_class t ON t.oid=i.indrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'),
  'triggers', (SELECT jsonb_agg(jsonb_build_object(
    'table',c.relname,'name',t.tgname,'definition',pg_catalog.pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled
  ) ORDER BY c.relname,t.tgname) FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
    'name',p.proname,'definition',pg_catalog.pg_get_functiondef(p.oid)
  ) ORDER BY p.proname) FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prorettype='trigger'::regtype),
  'sequences', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.sequencename)
    FROM pg_catalog.pg_sequences s WHERE s.schemaname='public'),
  'policies', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.tablename,p.policyname),'[]'::jsonb)
    FROM pg_catalog.pg_policies p WHERE p.schemaname='public'),
  'grants', (SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.table_name,g.grantee,g.privilege_type),'[]'::jsonb)
    FROM information_schema.role_table_grants g WHERE g.table_schema='public')
) AS catalog;
