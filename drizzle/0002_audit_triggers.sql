-- Database-level audit trail. Row-level triggers on every CRM domain table write one
-- audit row per INSERT/UPDATE/DELETE with before/after jsonb snapshots. Attribution
-- comes from transaction-local GUCs set by runAudited (src/lib/crm/audit/context.ts);
-- unset GUCs land as NULL. Fully idempotent: safe to re-run.
--
-- Adding a domain table means adding it to the `audited` array below in a new migration
-- and, if it should be undoable, to UNDO_TABLES in src/lib/crm/audit/undo.ts.

ALTER TABLE crm.audit_log
  ADD CONSTRAINT audit_log_operation_check
  CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'));

-- One trigger function for every audited table. row_id comes from the primary-key
-- column named by TG_ARGV[0] (default 'id'); organization_id is read out of the row
-- jsonb, which yields NULL for tables that have no such column.
CREATE OR REPLACE FUNCTION crm.audit_row_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_id_col text := COALESCE(TG_ARGV[0], 'id');
  v_before jsonb;
  v_after jsonb;
  v_row_id text;
  v_org_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_before := to_jsonb(OLD);
    v_after := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_before := NULL;
    v_after := to_jsonb(NEW);
  ELSE
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  END IF;

  v_row_id := COALESCE(v_after ->> v_id_col, v_before ->> v_id_col);
  v_org_id := COALESCE(v_after ->> 'organization_id', v_before ->> 'organization_id');

  -- created_at is clock_timestamp(), not now(): now() is frozen for the whole
  -- transaction, and undo needs the true write order within one batch to apply
  -- inverses reverse-chronologically (e.g. reinsert a client before its deal).
  INSERT INTO crm.audit_log (
    organization_id, table_name, row_id, operation, before, after,
    actor_type, actor_user_id, on_behalf_user_id, source, request_id, undo_of,
    created_at
  ) VALUES (
    v_org_id,
    TG_TABLE_NAME,
    v_row_id,
    TG_OP,
    v_before,
    v_after,
    NULLIF(current_setting('crm.actor_type', true), ''),
    NULLIF(current_setting('crm.actor_user_id', true), ''),
    NULLIF(current_setting('crm.on_behalf_user_id', true), ''),
    NULLIF(current_setting('crm.source', true), ''),
    NULLIF(current_setting('crm.request_id', true), ''),
    NULLIF(current_setting('crm.undo_of', true), ''),
    clock_timestamp()
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  id_col text;
  -- table -> primary-key column. Every audited table keys on id except
  -- organization_settings, whose primary key is organization_id.
  audited text[][] := ARRAY[
    ['clients', 'id'],
    ['people', 'id'],
    ['rapport_entries', 'id'],
    ['deals', 'id'],
    ['projects', 'id'],
    ['tickets', 'id'],
    ['ticket_assignees', 'id'],
    ['deal_assignees', 'id'],
    ['activities', 'id'],
    ['documents', 'id'],
    ['enum_options', 'id'],
    ['organization_settings', 'organization_id']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(audited, 1) LOOP
    t := audited[i][1];
    id_col := audited[i][2];
    IF to_regclass('crm.' || t) IS NULL THEN
      RAISE NOTICE 'audit: table crm.% missing, skipped', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON crm.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON crm.%1$I '
      'FOR EACH ROW EXECUTE FUNCTION crm.audit_row_change(%2$L)',
      t, id_col
    );
  END LOOP;
END;
$$;
