CREATE TYPE "public"."area_result" AS ENUM('No finding', 'Finding raised');--> statement-breakpoint
CREATE TYPE "public"."area_status" AS ENUM('To Do', 'In Testing', 'Blocked', 'Tested');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'denied', 'failure');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('Progress', 'Finding', 'Escalation', 'Retest', 'Report', 'Switch', 'Close-out', 'Blocker', 'Incident', 'Access');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('Open', 'Triaged', 'In Fix', 'Ready for Retest', 'Closed', 'Rejected', 'Risk Accepted', 'Won''t Fix');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('OWNER', 'MANAGER', 'SECURITY_TESTER', 'DEVELOPER');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('draft', 'pending_review', 'active', 'rejected', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."product_access" AS ENUM('view', 'edit');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('Not started', 'In progress', 'Paused', 'Baseline complete', 'Continuous');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('daily', 'weekly', 'monthly', 'closeout');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('Critical', 'High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."testing_request_status" AS ENUM('submitted', 'accepted', 'declined', 'scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('email_verify', 'org_invite', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"org_id" uuid,
	"token_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "auth_tokens_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_tokens_invite_has_org" CHECK (("auth_tokens"."purpose" = 'org_invite') = ("auth_tokens"."org_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip" "inet",
	"user_agent" text,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"platform_role" "platform_role",
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_active_has_password" CHECK ("users"."status" <> 'active' or "users"."password_hash" is not null)
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" NOT NULL,
	"status" "membership_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "org_status" DEFAULT 'draft' NOT NULL,
	"industry" text,
	"size" text,
	"website" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"finding_prefix" text NOT NULL,
	"next_finding_no" integer DEFAULT 1 NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organizations_slug_format" CHECK ("organizations"."slug" ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'),
	CONSTRAINT "organizations_prefix_format" CHECK ("organizations"."finding_prefix" ~ '^[A-Z][A-Z0-9]{1,9}$'),
	CONSTRAINT "organizations_rejected_has_note" CHECK ("organizations"."status" <> 'rejected' or "organizations"."review_note" is not null)
);
--> statement-breakpoint
CREATE TABLE "product_members" (
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"access" "product_access" DEFAULT 'view' NOT NULL,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_members_product_id_user_id_pk" PRIMARY KEY("product_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid,
	"type" "event_type" NOT NULL,
	"body" text NOT NULL,
	"occurred_on" date NOT NULL,
	"author_id" uuid,
	"author_platform" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_snapshots" (
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"taken_on" date NOT NULL,
	"coverage_pct" smallint NOT NULL,
	CONSTRAINT "coverage_snapshots_product_id_taken_on_pk" PRIMARY KEY("product_id","taken_on"),
	CONSTRAINT "coverage_pct_range" CHECK ("coverage_snapshots"."coverage_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "cycle_completions" (
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"cycle_key" text NOT NULL,
	"completed_on" date NOT NULL,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycle_completions_product_id_cycle_key_completed_on_pk" PRIMARY KEY("product_id","cycle_key","completed_on")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"product_id" uuid NOT NULL,
	"test_area_id" uuid,
	"testing_request_id" uuid,
	"raised_by_platform" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"severity" "severity" NOT NULL,
	"status" "finding_status" DEFAULT 'Open' NOT NULL,
	"status_reason" text,
	"cvss" text,
	"description" text,
	"steps" text,
	"impact" text,
	"evidence" text,
	"recommendation" text,
	"reference" text,
	"affected_feature" text,
	"found_while" text,
	"environment" text,
	"related_task" text,
	"previous_test" text,
	"discovery_method" text,
	"target_release" text,
	"late" boolean DEFAULT false NOT NULL,
	"late_cause" text,
	"exploitation_suspected" boolean DEFAULT false NOT NULL,
	"found_on" date NOT NULL,
	"due_on" date,
	"retest_due_on" date,
	"validated_at" timestamp with time zone,
	"reported_at" timestamp with time zone,
	"ready_for_retest_at" timestamp with time zone,
	"retest_requested_at" timestamp with time zone,
	"retest_completed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"reported_by" uuid,
	"assignee_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_orgId_key_unique" UNIQUE("org_id","key"),
	CONSTRAINT "findings_exit_has_reason" CHECK ("findings"."status" not in ('Rejected', 'Risk Accepted', 'Won''t Fix') or "findings"."status_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tier" smallint NOT NULL,
	"status" "product_status" DEFAULT 'Not started' NOT NULL,
	"domain" text,
	"owner_name" text,
	"jira_epic" text,
	"technology" text,
	"data_sensitivity" text,
	"baseline_start" date,
	"est_days" integer,
	"closeout_on" date,
	"last_tested_on" date,
	"resume_on" date,
	"switch_reason" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_orgId_slug_unique" UNIQUE("org_id","slug"),
	CONSTRAINT "products_org_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "products_tier_range" CHECK ("products"."tier" between 1 and 3),
	CONSTRAINT "products_est_days_positive" CHECK ("products"."est_days" is null or "products"."est_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid,
	"type" "report_type" NOT NULL,
	"period_on" date NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"generated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"high_risk" boolean DEFAULT false NOT NULL,
	"status" "area_status" DEFAULT 'To Do' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"jira_key" text,
	"method" text,
	"result" "area_result",
	"notes" text,
	"blocked_reason" text,
	"started_at" timestamp with time zone,
	"tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_areas_productId_name_unique" UNIQUE("product_id","name"),
	CONSTRAINT "test_areas_org_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "test_areas_blocked_has_reason" CHECK ("test_areas"."status" <> 'Blocked' or "test_areas"."blocked_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "testing_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"scope" text NOT NULL,
	"environment" text,
	"notes" text,
	"contact" text,
	"preferred_start" date,
	"preferred_end" date,
	"status" "testing_request_status" DEFAULT 'submitted' NOT NULL,
	"decision_note" text,
	"assigned_to" uuid,
	"scheduled_start" date,
	"scheduled_end" date,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "testing_requests_org_id_key" UNIQUE("org_id","id"),
	CONSTRAINT "testing_requests_declined_has_note" CHECK ("testing_requests"."status" <> 'declined' or "testing_requests"."decision_note" is not null)
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"body_text" text,
	"body_html" text,
	"link" text,
	"token_id" uuid,
	"org_id" uuid,
	"user_id" uuid,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "org_stats" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"products" integer DEFAULT 0 NOT NULL,
	"members" integer DEFAULT 0 NOT NULL,
	"open_critical" integer DEFAULT 0 NOT NULL,
	"open_high" integer DEFAULT 0 NOT NULL,
	"open_total" integer DEFAULT 0 NOT NULL,
	"overdue" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text,
	"actor_platform" boolean DEFAULT false NOT NULL,
	"action" text NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"org_id" uuid,
	"entity_type" text,
	"entity_id" text,
	"product_id" uuid,
	"changes" jsonb,
	"meta" jsonb,
	"email_hash" text,
	"ip" "inet",
	"user_agent" text,
	"request_id" text
);
--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_member_fk" FOREIGN KEY ("org_id","user_id") REFERENCES "public"."memberships"("org_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_snapshots" ADD CONSTRAINT "coverage_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_snapshots" ADD CONSTRAINT "coverage_snapshots_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_completions" ADD CONSTRAINT "cycle_completions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_completions" ADD CONSTRAINT "cycle_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_completions" ADD CONSTRAINT "cycle_completions_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_test_area_fk" FOREIGN KEY ("org_id","test_area_id") REFERENCES "public"."test_areas"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_testing_request_fk" FOREIGN KEY ("org_id","testing_request_id") REFERENCES "public"."testing_requests"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_areas" ADD CONSTRAINT "test_areas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_areas" ADD CONSTRAINT "test_areas_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testing_requests" ADD CONSTRAINT "testing_requests_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testing_requests" ADD CONSTRAINT "testing_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testing_requests" ADD CONSTRAINT "testing_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testing_requests" ADD CONSTRAINT "testing_requests_product_fk" FOREIGN KEY ("org_id","product_id") REFERENCES "public"."products"("org_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_token_id_auth_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."auth_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_stats" ADD CONSTRAINT "org_stats_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_purpose_index" ON "auth_tokens" USING btree ("user_id","purpose");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_user_id_index" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organizations_status_submitted_at_index" ON "organizations" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "product_members_org_id_user_id_index" ON "product_members" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_events_org_id_occurred_on_index" ON "activity_events" USING btree ("org_id","occurred_on");--> statement-breakpoint
CREATE INDEX "activity_events_product_id_occurred_on_index" ON "activity_events" USING btree ("product_id","occurred_on");--> statement-breakpoint
CREATE INDEX "coverage_snapshots_org_id_taken_on_index" ON "coverage_snapshots" USING btree ("org_id","taken_on");--> statement-breakpoint
CREATE INDEX "findings_org_id_status_due_on_index" ON "findings" USING btree ("org_id","status","due_on");--> statement-breakpoint
CREATE INDEX "findings_product_id_status_index" ON "findings" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "reports_org_id_created_at_index" ON "reports" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "testing_requests_status_created_at_index" ON "testing_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "testing_requests_org_id_created_at_index" ON "testing_requests" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "email_outbox_status_created_at_index" ON "email_outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "email_outbox_org_id_index" ON "email_outbox" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "email_outbox_token_id_index" ON "email_outbox" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_index" ON "audit_logs" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_org_idx" ON "audit_logs" USING btree ("org_id","occurred_at" desc);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_occurred_at_index" ON "audit_logs" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_index" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","occurred_at" desc);--> statement-breakpoint
CREATE INDEX "audit_logs_email_hash_occurred_at_index" ON "audit_logs" USING btree ("email_hash","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_ip_occurred_at_index" ON "audit_logs" USING btree ("ip","occurred_at");