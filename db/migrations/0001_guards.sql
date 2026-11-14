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

-- 2. The single SUPER_ADMIN (platform account) can't be demoted, suspended or deleted,
--    and nobody can be promoted to it once it exists (also enforced by users_one_super_admin).
CREATE FUNCTION users_protect_super_admin() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role = 'SUPER_ADMIN' AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR NEW.role <> 'SUPER_ADMIN' OR NEW.status <> 'active') THEN
    RAISE EXCEPTION 'the SUPER_ADMIN account cannot be demoted, suspended or deleted'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_protect_super_admin
  BEFORE UPDATE OF role, status OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION users_protect_super_admin();
