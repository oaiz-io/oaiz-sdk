-- The test schema OAIZ renders from this database. Do not edit it.
-- It builds this database's tables, constraints, functions, views, triggers, row policies and data roles in an empty
-- PostgreSQL, with no rows.

CREATE ROLE "oaiz_test_read" NOLOGIN;
CREATE ROLE "oaiz_test_write" NOLOGIN;
CREATE ROLE "oaiz_test_owner" NOLOGIN;
CREATE SCHEMA "data";
CREATE SCHEMA "oaiz_private";
GRANT USAGE ON SCHEMA "data" TO "oaiz_test_read", "oaiz_test_write", "oaiz_test_owner";
GRANT USAGE ON SCHEMA "oaiz_private" TO "oaiz_test_read", "oaiz_test_write", "oaiz_test_owner";
GRANT CREATE ON SCHEMA "data" TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_subject() RETURNS uuid
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.subject', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.subject identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    RETURN published::uuid;
END
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_organisation() RETURNS uuid
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.organisation_id', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.organisation_id identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    RETURN published::uuid;
END
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_database() RETURNS text
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.storage_database', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.storage_database identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    RETURN published::text;
END
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_capability() RETURNS text
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.capability', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.capability identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    RETURN published::text;
END
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_organisation_role() RETURNS text
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.organisation_role', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.organisation_role identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    RETURN published::text;
END
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_teams() RETURNS uuid[]
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
    SELECT string_to_array(coalesce(current_setting('oaiz.teams', true), ''), ',')::uuid[]
$accessor$;

CREATE OR REPLACE FUNCTION oaiz_private.oaiz_app() RETURNS uuid
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = oaiz_private, pg_temp
    AS $accessor$
DECLARE
    published text := current_setting('oaiz.app', true);
BEGIN
    IF published IS NULL OR published = '' THEN
        RAISE EXCEPTION 'the oaiz.app identity claim is not published'
            USING ERRCODE = 'invalid_authorization_specification';
    END IF;
    IF published = 'none' THEN
        RETURN NULL;
    END IF;
    RETURN published::uuid;
END
$accessor$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "oaiz_private" FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_subject"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_subject"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_organisation"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_organisation"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_database"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_database"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_capability"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_capability"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_organisation_role"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_organisation_role"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_teams"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_teams"() TO "oaiz_test_owner";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_app"() TO "oaiz_test_read", "oaiz_test_write";
GRANT EXECUTE ON FUNCTION "oaiz_private"."oaiz_app"() TO "oaiz_test_owner";

ALTER DEFAULT PRIVILEGES FOR ROLE "oaiz_test_owner" IN SCHEMA "data" GRANT SELECT ON TABLES TO "oaiz_test_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "oaiz_test_owner" IN SCHEMA "data" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "oaiz_test_write";
ALTER DEFAULT PRIVILEGES FOR ROLE "oaiz_test_owner" IN SCHEMA "data" GRANT USAGE ON SEQUENCES TO "oaiz_test_write";
ALTER DEFAULT PRIVILEGES FOR ROLE "oaiz_test_owner" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE "oaiz_test_owner" IN SCHEMA "data" GRANT EXECUTE ON FUNCTIONS TO "oaiz_test_read", "oaiz_test_write";

SET ROLE "oaiz_test_owner";
SET search_path TO data, extensions, pg_temp;

CREATE TYPE "data"."priority" AS ENUM ('low', 'high');

CREATE SEQUENCE "data"."notes_id_seq" AS integer INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 NO CYCLE;

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION data."TaskTotal"("left" integer)
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT least(count(*)::integer, "left") FROM data.tasks
$function$;
ALTER FUNCTION "data"."TaskTotal"("left" integer) OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data._hidden()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT 1
$function$;
ALTER FUNCTION "data"."_hidden"() OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.add_task(p_title text)
 RETURNS bigint
 LANGUAGE sql
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    INSERT INTO data.tasks (project_id, owner_id, title)
    VALUES (1, oaiz_private.oaiz_subject(), p_title)
    RETURNING id
$function$;
ALTER FUNCTION "data"."add_task"(p_title text) OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.numbers(p_count integer)
 RETURNS SETOF integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT pg_catalog.generate_series(1, p_count)
$function$;
ALTER FUNCTION "data"."numbers"(p_count integer) OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.rename_task(p_id bigint, p_title text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    UPDATE data.tasks SET title = p_title WHERE id = p_id
$function$;
ALTER FUNCTION "data"."rename_task"(p_id bigint, p_title text) OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.sneaky_stable()
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
BEGIN
    RETURN data.add_task('Sneaky');
END
$function$;
ALTER FUNCTION "data"."sneaky_stable"() OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.task_audit_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
BEGIN
    INSERT INTO data.task_audit (task_id, owner_id, operation) VALUES (NEW.id, NEW.owner_id, TG_OP);
    RETURN NULL;
END
$function$;
ALTER FUNCTION "data"."task_audit_write"() OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.task_count()
 RETURNS integer
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT count(*)::integer FROM data.tasks
$function$;
ALTER FUNCTION "data"."task_count"() OWNER TO "oaiz_test_owner";

CREATE OR REPLACE FUNCTION data.task_summary(OUT total integer, OUT largest_estimate bigint)
 RETURNS record
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT count(*)::integer, max(estimate) FROM data.tasks
$function$;
ALTER FUNCTION "data"."task_summary"(OUT total integer, OUT largest_estimate bigint) OWNER TO "oaiz_test_owner";

CREATE TABLE "data"."notes" (
    "id" integer DEFAULT nextval('notes_id_seq'::regclass) NOT NULL,
    "task_id" bigint NOT NULL,
    "follow_up_task_id" bigint,
    "body" text,
    "attachment" bytea,
    "pinned" boolean
);

CREATE TABLE "data"."projects" (
    "id" bigint GENERATED ALWAYS AS IDENTITY (INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE) NOT NULL,
    "name" text NOT NULL,
    "team_id" uuid
);

CREATE TABLE "data"."readings" (
    "id" integer NOT NULL
);

CREATE TABLE "data"."task_audit" (
    "id" bigint GENERATED ALWAYS AS IDENTITY (INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE) NOT NULL,
    "task_id" bigint NOT NULL,
    "owner_id" uuid NOT NULL,
    "operation" text NOT NULL
);

CREATE TABLE "data"."tasks" (
    "id" bigint GENERATED ALWAYS AS IDENTITY (INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 NO CYCLE) NOT NULL,
    "project_id" bigint NOT NULL,
    "owner_id" uuid NOT NULL,
    "title" text NOT NULL,
    "status" text DEFAULT 'open'::text NOT NULL,
    "priority" priority,
    "estimate" bigint,
    "due" date,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER SEQUENCE "data"."notes_id_seq" OWNED BY "data"."notes"."id";

CREATE OR REPLACE FUNCTION data.my_tasks(p_limit integer DEFAULT 10)
 RETURNS SETOF tasks
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT * FROM data.tasks ORDER BY id LIMIT p_limit
$function$;
ALTER FUNCTION "data"."my_tasks"(p_limit integer) OWNER TO "oaiz_test_owner";

ALTER TABLE "data"."notes" ADD CONSTRAINT "notes_pkey" PRIMARY KEY (id);
ALTER TABLE "data"."projects" ADD CONSTRAINT "projects_name_key" UNIQUE (name);
ALTER TABLE "data"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY (id);
ALTER TABLE "data"."readings" ADD CONSTRAINT "readings_pkey" PRIMARY KEY (id);
ALTER TABLE "data"."task_audit" ADD CONSTRAINT "task_audit_pkey" PRIMARY KEY (id);
ALTER TABLE "data"."tasks" ADD CONSTRAINT "tasks_pkey" PRIMARY KEY (id);
ALTER TABLE "data"."tasks" ADD CONSTRAINT "tasks_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'doing'::text, 'done'::text])));

CREATE INDEX tasks_due_idx ON data.tasks USING btree (due);

ALTER TABLE "data"."notes" ADD CONSTRAINT "notes_follow_up_task_id_fkey" FOREIGN KEY (follow_up_task_id) REFERENCES tasks(id);
ALTER TABLE "data"."notes" ADD CONSTRAINT "notes_task_id_fkey" FOREIGN KEY (task_id) REFERENCES tasks(id);
ALTER TABLE "data"."tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

CREATE VIEW "data"."open_tasks" WITH (security_invoker=true) AS
SELECT id,
    owner_id,
    title,
    status
   FROM tasks
  WHERE status <> 'done'::text;

CREATE OR REPLACE FUNCTION data.my_open_tasks()
 RETURNS SETOF open_tasks
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
AS $function$
    SELECT * FROM data.open_tasks ORDER BY id
$function$;
ALTER FUNCTION "data"."my_open_tasks"() OWNER TO "oaiz_test_owner";

CREATE TRIGGER task_audit AFTER INSERT OR UPDATE ON data.tasks FOR EACH ROW EXECUTE FUNCTION task_audit_write();

ALTER TABLE "data"."notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."notes" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "data"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."projects" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "data"."readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."readings" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "data"."task_audit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."task_audit" NO FORCE ROW LEVEL SECURITY;

ALTER TABLE "data"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."tasks" NO FORCE ROW LEVEL SECURITY;

RESET ROLE;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('notes');
    guard text := 'oaiz_private.oaiz_organisation() = ' || quote_literal(tenant) || '::uuid'
        || ' AND oaiz_private.oaiz_database() = ' || quote_literal(physical);
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_tenant ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_tenant ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_insert ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_insert ON ' || target
        || ' AS RESTRICTIVE FOR INSERT TO PUBLIC'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_update ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_update ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_delete ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_delete ON ' || target
        || ' AS RESTRICTIVE FOR DELETE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_owner ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_owner ON ' || target
        || ' AS PERMISSIVE FOR ALL TO PUBLIC'
        || ' USING (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')';
END
$oaiz_test$;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('projects');
    guard text := 'oaiz_private.oaiz_organisation() = ' || quote_literal(tenant) || '::uuid'
        || ' AND oaiz_private.oaiz_database() = ' || quote_literal(physical);
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_tenant ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_tenant ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_insert ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_insert ON ' || target
        || ' AS RESTRICTIVE FOR INSERT TO PUBLIC'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_update ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_update ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_delete ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_delete ON ' || target
        || ' AS RESTRICTIVE FOR DELETE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_owner ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_owner ON ' || target
        || ' AS PERMISSIVE FOR ALL TO PUBLIC'
        || ' USING (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')';
END
$oaiz_test$;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('readings');
    guard text := 'oaiz_private.oaiz_organisation() = ' || quote_literal(tenant) || '::uuid'
        || ' AND oaiz_private.oaiz_database() = ' || quote_literal(physical);
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_tenant ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_tenant ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_insert ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_insert ON ' || target
        || ' AS RESTRICTIVE FOR INSERT TO PUBLIC'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_update ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_update ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_delete ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_delete ON ' || target
        || ' AS RESTRICTIVE FOR DELETE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_owner ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_owner ON ' || target
        || ' AS PERMISSIVE FOR ALL TO PUBLIC'
        || ' USING (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')';
END
$oaiz_test$;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('task_audit');
    guard text := 'oaiz_private.oaiz_organisation() = ' || quote_literal(tenant) || '::uuid'
        || ' AND oaiz_private.oaiz_database() = ' || quote_literal(physical);
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_tenant ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_tenant ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_insert ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_insert ON ' || target
        || ' AS RESTRICTIVE FOR INSERT TO PUBLIC'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_update ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_update ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_delete ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_delete ON ' || target
        || ' AS RESTRICTIVE FOR DELETE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_owner ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_owner ON ' || target
        || ' AS PERMISSIVE FOR ALL TO PUBLIC'
        || ' USING (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')';
END
$oaiz_test$;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('tasks');
    guard text := 'oaiz_private.oaiz_organisation() = ' || quote_literal(tenant) || '::uuid'
        || ' AND oaiz_private.oaiz_database() = ' || quote_literal(physical);
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_tenant ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_tenant ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''view'', ''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_insert ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_insert ON ' || target
        || ' AS RESTRICTIVE FOR INSERT TO PUBLIC'
        || ' WITH CHECK (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_update ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_update ON ' || target
        || ' AS RESTRICTIVE FOR UPDATE TO PUBLIC'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_delete ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_delete ON ' || target
        || ' AS RESTRICTIVE FOR DELETE TO PUBLIC'
        || ' USING (' || guard || ' AND oaiz_private.oaiz_capability() IN (''edit'', ''owner'')' || ')';
    EXECUTE 'DROP POLICY IF EXISTS oaiz_platform_owner ON ' || target;
    EXECUTE 'CREATE POLICY oaiz_platform_owner ON ' || target
        || ' AS PERMISSIVE FOR ALL TO PUBLIC'
        || ' USING (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')'
        || ' WITH CHECK (' || 'oaiz_private.oaiz_capability() = ''owner''' || ')';
END
$oaiz_test$;

CREATE POLICY "everyone_can_add" ON "data"."notes" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
COMMENT ON POLICY "everyone_can_add" ON "data"."notes" IS 'Everyone who may edit this database adds any row. Drop or replace this policy to limit who adds which rows.';
CREATE POLICY "everyone_can_change" ON "data"."notes" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
COMMENT ON POLICY "everyone_can_change" ON "data"."notes" IS 'Everyone who may edit this database changes every row. Drop or replace this policy to limit who changes which rows.';
CREATE POLICY "everyone_can_delete" ON "data"."notes" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_delete" ON "data"."notes" IS 'Everyone who may edit this database deletes any row. Drop or replace this policy to limit who deletes which rows.';
CREATE POLICY "everyone_can_see" ON "data"."notes" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_see" ON "data"."notes" IS 'Everyone with access to this database sees every row. Drop or replace this policy to limit who sees which rows.';

CREATE POLICY "everyone_can_add" ON "data"."projects" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
COMMENT ON POLICY "everyone_can_add" ON "data"."projects" IS 'Everyone who may edit this database adds any row. Drop or replace this policy to limit who adds which rows.';
CREATE POLICY "everyone_can_change" ON "data"."projects" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
COMMENT ON POLICY "everyone_can_change" ON "data"."projects" IS 'Everyone who may edit this database changes every row. Drop or replace this policy to limit who changes which rows.';
CREATE POLICY "everyone_can_delete" ON "data"."projects" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_delete" ON "data"."projects" IS 'Everyone who may edit this database deletes any row. Drop or replace this policy to limit who deletes which rows.';
CREATE POLICY "everyone_can_see" ON "data"."projects" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_see" ON "data"."projects" IS 'Everyone with access to this database sees every row. Drop or replace this policy to limit who sees which rows.';
CREATE POLICY "team_projects" ON "data"."projects" AS RESTRICTIVE FOR SELECT TO PUBLIC USING (((team_id IS NULL) OR (team_id = ANY (oaiz_private.oaiz_teams()))));
COMMENT ON POLICY "team_projects" ON "data"."projects" IS 'A project with a team is seen only by that team''s members.';

CREATE POLICY "everyone_can_add" ON "data"."readings" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
COMMENT ON POLICY "everyone_can_add" ON "data"."readings" IS 'Everyone who may edit this database adds any row. Drop or replace this policy to limit who adds which rows.';
CREATE POLICY "everyone_can_change" ON "data"."readings" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
COMMENT ON POLICY "everyone_can_change" ON "data"."readings" IS 'Everyone who may edit this database changes every row. Drop or replace this policy to limit who changes which rows.';
CREATE POLICY "everyone_can_delete" ON "data"."readings" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_delete" ON "data"."readings" IS 'Everyone who may edit this database deletes any row. Drop or replace this policy to limit who deletes which rows.';
CREATE POLICY "everyone_can_see" ON "data"."readings" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_see" ON "data"."readings" IS 'Everyone with access to this database sees every row. Drop or replace this policy to limit who sees which rows.';

CREATE POLICY "everyone_can_add" ON "data"."task_audit" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
COMMENT ON POLICY "everyone_can_add" ON "data"."task_audit" IS 'Everyone who may edit this database adds any row. Drop or replace this policy to limit who adds which rows.';
CREATE POLICY "everyone_can_change" ON "data"."task_audit" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
COMMENT ON POLICY "everyone_can_change" ON "data"."task_audit" IS 'Everyone who may edit this database changes every row. Drop or replace this policy to limit who changes which rows.';
CREATE POLICY "everyone_can_delete" ON "data"."task_audit" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_delete" ON "data"."task_audit" IS 'Everyone who may edit this database deletes any row. Drop or replace this policy to limit who deletes which rows.';
CREATE POLICY "no_one_changes" ON "data"."task_audit" AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY "no_one_deletes" ON "data"."task_audit" AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);
CREATE POLICY "only_the_trigger_adds" ON "data"."task_audit" AS RESTRICTIVE FOR INSERT TO PUBLIC WITH CHECK ((pg_trigger_depth() > 0));
CREATE POLICY "own_task_audit" ON "data"."task_audit" AS PERMISSIVE FOR SELECT TO PUBLIC USING ((owner_id = oaiz_private.oaiz_subject()));

CREATE POLICY "own_tasks" ON "data"."tasks" AS PERMISSIVE FOR ALL TO PUBLIC USING ((owner_id = oaiz_private.oaiz_subject())) WITH CHECK ((owner_id = oaiz_private.oaiz_subject()));

RESET check_function_bodies;
RESET search_path;
