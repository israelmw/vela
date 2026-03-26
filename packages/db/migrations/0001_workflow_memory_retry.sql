ALTER TYPE "public"."run_step_status" ADD VALUE 'retrying' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "working_memory" (
	"session_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "working_memory_session_id_key_pk" PRIMARY KEY("session_id","key")
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "run_step_id" uuid;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "run_steps" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "working_memory" ADD CONSTRAINT "working_memory_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_run_step_id_run_steps_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."run_steps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_steps_run_id_idempotency_key_unique" ON "run_steps" USING btree ("run_id","idempotency_key");