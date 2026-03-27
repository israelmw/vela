ALTER TYPE "public"."approval_type" ADD VALUE 'policy_override';--> statement-breakpoint
CREATE TABLE "capability_installs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" uuid,
	"package_ref" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capability_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"manifest" jsonb NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capability_packages_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "quorum_required" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "votes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "parent_run_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "subagent_depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "capability_installs" ADD CONSTRAINT "capability_installs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_parent_run_id_runs_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;