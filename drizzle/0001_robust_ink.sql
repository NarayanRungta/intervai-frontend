CREATE TABLE "interview" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"difficulty" text DEFAULT 'intermediate' NOT NULL,
	"tone" text DEFAULT 'professional' NOT NULL,
	"custom_context" text,
	"status" text DEFAULT 'active' NOT NULL,
	"next_question_index" integer DEFAULT 1 NOT NULL,
	"pending_question" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"final_score" integer,
	"final_report" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_turn" (
	"id" text PRIMARY KEY NOT NULL,
	"interview_id" text NOT NULL,
	"question_index" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"score" integer NOT NULL,
	"feedback" text NOT NULL,
	"competency" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview" ADD CONSTRAINT "interview_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_turn" ADD CONSTRAINT "interview_turn_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_userId_idx" ON "interview" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_status_idx" ON "interview" USING btree ("status");--> statement-breakpoint
CREATE INDEX "interview_turn_interviewId_idx" ON "interview_turn" USING btree ("interview_id");--> statement-breakpoint
CREATE INDEX "interview_turn_questionIndex_idx" ON "interview_turn" USING btree ("question_index");