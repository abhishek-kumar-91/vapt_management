CREATE TYPE "public"."area_result" AS ENUM('No finding', 'Finding raised');--> statement-breakpoint
CREATE TYPE "public"."area_status" AS ENUM('To Do', 'In Testing', 'Blocked', 'Tested');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'denied', 'failure');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('Progress', 'Finding', 'Escalation', 'Retest', 'Report', 'Switch', 'Close-out', 'Blocker', 'Incident');--> statement-breakpoint
CREATE TYPE "public"."finding_status" AS ENUM('Open', 'Triaged', 'In Fix', 'Ready for Retest', 'Closed', 'Rejected', 'Risk Accepted', 'Won''t Fix');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('Not started', 'In progress', 'Paused', 'Baseline complete', 'Continuous');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('daily', 'weekly', 'monthly', 'closeout');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('Critical', 'High', 'Medium', 'Low');--> statement-breakpoint
CREATE TYPE "public"."token_purpose" AS ENUM('invite', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'OWNER', 'MANAGER', 'SECURITY_TESTER', 'DEVELOPER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'suspended', 'deactivated');--> statement-breakpoint
CREATE SEQUENCE "public"."finding_key_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "auth_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "product_members" (
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_members_product_id_user_id_pk" PRIMARY KEY("product_id","user_id")
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
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"password_changed_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_email_lowercase" CHECK ("users"."email" = lower("users"."email")),
	CONSTRAINT "users_active_has_password" CHECK ("users"."status" <> 'active' or "users"."password_hash" is not null)
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"type" "event_type" NOT NULL,
	"body" text NOT NULL,
	"occurred_on" date NOT NULL,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_snapshots" (
	"product_id" uuid NOT NULL,
	"taken_on" date NOT NULL,
	"coverage_pct" smallint NOT NULL,
	CONSTRAINT "coverage_snapshots_product_id_taken_on_pk" PRIMARY KEY("product_id","taken_on"),
	CONSTRAINT "coverage_pct_range" CHECK ("coverage_snapshots"."coverage_pct" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "cycle_completions" (
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
	"key" text DEFAULT ('VAPT-' || lpad(nextval('finding_key_seq')::text, 4, '0')) NOT NULL,
	"product_id" uuid NOT NULL,
	"test_area_id" uuid,
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
	CONSTRAINT "findings_key_unique" UNIQUE("key"),
	CONSTRAINT "findings_exit_has_reason" CHECK ("findings"."status" not in ('Rejected', 'Risk Accepted', 'Won''t Fix') or "findings"."status_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"tier" smallint NOT NULL,
	"status" "product_status" DEFAULT 'Not started' NOT NULL,
	"domain" text,
	"owner_id" uuid,
	"jira_epic" text,
	"technology" text,
	"data_sensitivity" text,
	"baseline_start" date,
	"est_days" integer,
	"closeout_on" date,
	"last_tested_on" date,
	"resume_on" date,
	"switch_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_tier_range" CHECK ("products"."tier" between 1 and 3),
	CONSTRAINT "products_est_days_positive" CHECK ("products"."est_days" is null or "products"."est_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	CONSTRAINT "test_areas_blocked_has_reason" CHECK ("test_areas"."status" <> 'Blocked' or "test_areas"."blocked_reason" is not null)
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" "user_role",
	"action" text NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
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
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_members" ADD CONSTRAINT "product_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_snapshots" ADD CONSTRAINT "coverage_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_completions" ADD CONSTRAINT "cycle_completions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_completions" ADD CONSTRAINT "cycle_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_test_area_id_test_areas_id_fk" FOREIGN KEY ("test_area_id") REFERENCES "public"."test_areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_areas" ADD CONSTRAINT "test_areas_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_index" ON "auth_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_members_user_id_index" ON "product_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_index" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_one_super_admin" ON "users" USING btree ("role") WHERE "users"."role" = 'SUPER_ADMIN';--> statement-breakpoint
CREATE INDEX "activity_events_occurred_on_index" ON "activity_events" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "activity_events_product_id_occurred_on_index" ON "activity_events" USING btree ("product_id","occurred_on");--> statement-breakpoint
CREATE INDEX "findings_product_id_status_index" ON "findings" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "findings_status_due_on_index" ON "findings" USING btree ("status","due_on");--> statement-breakpoint
CREATE INDEX "reports_created_at_index" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_index" ON "audit_logs" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_occurred_at_index" ON "audit_logs" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_index" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_product_id_occurred_at_index" ON "audit_logs" USING btree ("product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action","occurred_at" desc);--> statement-breakpoint
CREATE INDEX "audit_logs_email_hash_occurred_at_index" ON "audit_logs" USING btree ("email_hash","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_ip_occurred_at_index" ON "audit_logs" USING btree ("ip","occurred_at");