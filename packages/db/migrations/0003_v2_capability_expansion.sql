CREATE TYPE "public"."secret_binding_status" AS ENUM('active', 'expired', 'revoked');--> statement-breakpoint
CREATE TABLE "mcp_discovered_tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_id" text NOT NULL,
	"tool_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"input_schema" jsonb NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"run_id" uuid,
	"content" text NOT NULL,
	"embedding" jsonb NOT NULL,
	"meta" jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"step_index" integer,
	"level" text NOT NULL,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"request_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD COLUMN "capability_tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD COLUMN "required_scopes" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD COLUMN "last_health_check" timestamp;--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD COLUMN "last_health_ok" boolean;--> statement-breakpoint
ALTER TABLE "mcp_registry" ADD COLUMN "meta" jsonb;--> statement-breakpoint
ALTER TABLE "secret_bindings" ADD COLUMN "status" "secret_binding_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "secret_bindings" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "secret_bindings" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "secret_bindings" ADD COLUMN "revoked_reason" text;--> statement-breakpoint
ALTER TABLE "tools_registry" ADD COLUMN "required_secret_provider" text;--> statement-breakpoint
ALTER TABLE "mcp_discovered_tools" ADD CONSTRAINT "mcp_discovered_tools_mcp_id_mcp_registry_id_fk" FOREIGN KEY ("mcp_id") REFERENCES "public"."mcp_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_embeddings" ADD CONSTRAINT "memory_embeddings_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_discovered_tools_mcp_tool_unique" ON "mcp_discovered_tools" USING btree ("mcp_id","tool_name");