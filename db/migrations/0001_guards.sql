-- Invariants the app must not be able to break, even with a bug or a direct SQL session.

-- 1. The audit log is append-only.
CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% refused)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
--> statement-breakpoint

-- 2. Only the CLI (`pnpm user:create`, which sets app.cli = on) can grant or remove platform_role.
CREATE FUNCTION users_protect_platform_role() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ((TG_OP = 'INSERT' AND NEW.platform_role IS NOT NULL)
      OR (TG_OP = 'UPDATE' AND NEW.platform_role IS DISTINCT FROM OLD.platform_role))
     AND coalesce(current_setting('app.cli', true), '') <> 'on' THEN
    RAISE EXCEPTION 'platform_role can only be changed with pnpm user:create'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_protect_platform_role
  BEFORE INSERT OR UPDATE OF platform_role ON users
  FOR EACH ROW EXECUTE FUNCTION users_protect_platform_role();
--> statement-breakpoint

-- 3. A company always keeps at least one active Owner. Locks the company row so two Owners
--    demoting each other at the same moment can't both succeed.
CREATE FUNCTION memberships_keep_an_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'OWNER' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'OWNER' OR NEW.status <> 'active') THEN
    PERFORM 1 FROM organizations WHERE id = OLD.org_id FOR UPDATE;
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE org_id = OLD.org_id AND role = 'OWNER' AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'a company needs at least one active Owner'
        USING ERRCODE = 'check_violation', CONSTRAINT = 'memberships_keep_an_owner';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER memberships_keep_an_owner
  AFTER UPDATE OF role, status OR DELETE ON memberships
  FOR EACH ROW EXECUTE FUNCTION memberships_keep_an_owner();
--> statement-breakpoint

-- 4. Row-level security. server/context.ts withOrg() sets these per transaction:
--      app.org_id    the company being acted in
--      app.user_id   the signed-in person (to find their own memberships before a company is chosen)
--      app.platform  'on' for Super Admins
--    Policies only bind roles that don't own the tables, so they take effect when the app
--    connects as app_user (integration plan, phase 9). Until then they are defined but inert.
CREATE FUNCTION app_org_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_user_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE FUNCTION app_platform() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(current_setting('app.platform', true), '') = 'on' $$;
--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON organizations USING (
  app_platform() OR id = app_org_id()
  OR EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = organizations.id AND m.user_id = app_user_id())
) WITH CHECK (app_platform() OR id = app_org_id());
--> statement-breakpoint
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON memberships USING (
  app_platform() OR org_id = app_org_id() OR user_id = app_user_id()
) WITH CHECK (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE product_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON product_members USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON products USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE test_areas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON test_areas USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE cycle_completions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON cycle_completions USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE coverage_snapshots ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON coverage_snapshots USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE testing_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON testing_requests USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON findings USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON activity_events USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON reports USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint
ALTER TABLE org_stats ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant ON org_stats USING (app_platform() OR org_id = app_org_id());
--> statement-breakpoint

-- 5. "Does this person still have access to another company?" can't be answered from inside one
--    company's scope, so it's a narrow SECURITY DEFINER function: one count, nothing else returned.
CREATE FUNCTION active_memberships_elsewhere(p_user uuid, p_org uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT count(*)::int FROM memberships WHERE user_id = p_user AND org_id <> p_org AND status = 'active' $$;
--> statement-breakpoint

-- 6. The role the app will connect as from phase 9. No login yet; can't edit or delete audit rows.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
