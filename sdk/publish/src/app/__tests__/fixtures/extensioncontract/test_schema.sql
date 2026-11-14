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

CREATE SCHEMA IF NOT EXISTS "extensions";
GRANT USAGE ON SCHEMA "extensions" TO "oaiz_test_read", "oaiz_test_write", "oaiz_test_owner";
CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "hstore" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "intarray" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "ltree" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";
REVOKE EXECUTE ON FUNCTION extensions.set_limit(real) FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";
CREATE OR REPLACE FUNCTION extensions.immutable_unaccent(text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT RETURN extensions.unaccent('extensions.unaccent'::regdictionary, $1);
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
REVOKE EXECUTE ON FUNCTION extensions.uuid_generate_v1() FROM PUBLIC;
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

SET ROLE "oaiz_test_owner";
SET search_path TO data, extensions, pg_temp;

SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION data.match_documents(query_embedding vector, match_count integer)
 RETURNS TABLE(id uuid, title text, similarity double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'data', 'extensions', 'pg_temp'
 SET "hnsw.ef_search" TO '100'
 SET "pg_trgm.similarity_threshold" TO '0.3'
AS $function$
    SELECT d.id, d.title, 1 - (d.embedding <=> query_embedding)
    FROM data.documents AS d
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count
$function$;
ALTER FUNCTION "data"."match_documents"(query_embedding vector, match_count integer) OWNER TO "oaiz_test_owner";

CREATE TABLE "data"."documents" (
    "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
    "title" text NOT NULL,
    "title_folded" text GENERATED ALWAYS AS (immutable_unaccent(lower(title))) STORED,
    "title_sound" text GENERATED ALWAYS AS (soundex(title)) STORED,
    "title_digest" bytea GENERATED ALWAYS AS (digest(title, 'sha256'::text)) STORED,
    "author_email" citext NOT NULL,
    "attributes" hstore,
    "path" ltree,
    "label_ids" integer[],
    "embedding" vector(3),
    "published_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "data"."documents" ADD CONSTRAINT "documents_author_email_key" UNIQUE (author_email);
ALTER TABLE "data"."documents" ADD CONSTRAINT "documents_pkey" PRIMARY KEY (id);

CREATE INDEX documents_attributes ON data.documents USING gin (attributes);
CREATE INDEX documents_embedding ON data.documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX documents_label_ids ON data.documents USING gin (label_ids gin__int_ops);
CREATE INDEX documents_path ON data.documents USING gist (path);
CREATE INDEX documents_published_at ON data.documents USING gin (published_at);
CREATE INDEX documents_title_gist ON data.documents USING gist (title);
CREATE INDEX documents_title_trgm ON data.documents USING gin (title gin_trgm_ops);

ALTER TABLE "data"."documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data"."documents" NO FORCE ROW LEVEL SECURITY;

RESET ROLE;

DO $oaiz_test$
DECLARE
    tenant uuid := '7e570000-0000-4000-8000-00000000000a';
    physical text := 'oaiz_test';
    target text := 'data.' || quote_ident('documents');
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

CREATE POLICY "everyone_can_add" ON "data"."documents" AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK (true);
COMMENT ON POLICY "everyone_can_add" ON "data"."documents" IS 'Everyone who may edit this database adds any row. Drop or replace this policy to limit who adds which rows.';
CREATE POLICY "everyone_can_change" ON "data"."documents" AS PERMISSIVE FOR UPDATE TO PUBLIC USING (true) WITH CHECK (true);
COMMENT ON POLICY "everyone_can_change" ON "data"."documents" IS 'Everyone who may edit this database changes every row. Drop or replace this policy to limit who changes which rows.';
CREATE POLICY "everyone_can_delete" ON "data"."documents" AS PERMISSIVE FOR DELETE TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_delete" ON "data"."documents" IS 'Everyone who may edit this database deletes any row. Drop or replace this policy to limit who deletes which rows.';
CREATE POLICY "everyone_can_see" ON "data"."documents" AS PERMISSIVE FOR SELECT TO PUBLIC USING (true);
COMMENT ON POLICY "everyone_can_see" ON "data"."documents" IS 'Everyone with access to this database sees every row. Drop or replace this policy to limit who sees which rows.';

RESET check_function_bodies;
RESET search_path;
