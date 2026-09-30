CREATE TABLE "game_results" (
	"game_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"final_score" integer NOT NULL,
	"final_rank" smallint NOT NULL,
	"is_winner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_results_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"rounds_planned" smallint NOT NULL,
	"rounds_completed" smallint DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "games_status_check" CHECK ("games"."status" in ('STARTING','IN_PROGRESS','FINISHED','ABANDONED'))
);
--> statement-breakpoint
CREATE TABLE "room_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"seat_order" smallint NOT NULL,
	"is_host_start" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"host_user_id" uuid NOT NULL,
	"max_players" smallint NOT NULL,
	"rounds" smallint NOT NULL,
	"round_duration" smallint NOT NULL,
	"hints" smallint NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "rooms_code_len_check" CHECK (char_length("rooms"."code") between 5 and 6),
	CONSTRAINT "rooms_name_len_check" CHECK (char_length("rooms"."name") between 1 and 30),
	CONSTRAINT "rooms_max_players_check" CHECK ("rooms"."max_players" between 2 and 8),
	CONSTRAINT "rooms_rounds_check" CHECK ("rooms"."rounds" >= 1),
	CONSTRAINT "rooms_round_duration_check" CHECK ("rooms"."round_duration" >= 30),
	CONSTRAINT "rooms_hints_check" CHECK ("rooms"."hints" >= 0),
	CONSTRAINT "rooms_status_check" CHECK ("rooms"."status" in ('WAITING','IN_GAME','CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_number" smallint NOT NULL,
	"drawer_user_id" uuid NOT NULL,
	"word_id" uuid NOT NULL,
	"masked_word_final" text,
	"status" text NOT NULL,
	"end_reason" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "rounds_status_check" CHECK ("rounds"."status" in ('ACTIVE','FINISHED','ABANDONED')),
	CONSTRAINT "rounds_end_reason_check" CHECK ("rounds"."end_reason" is null or "rounds"."end_reason" in
        ('TIMER_EXPIRED','ALL_GUESSERS_CORRECT','DRAWER_ABANDONED','SERVER_TERMINATED'))
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"round_id" uuid,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"points" integer NOT NULL,
	"rank_in_round" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_kind_check" CHECK ("scores"."kind" in ('guess','drawer'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"is_guest" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_nickname_len_check" CHECK (char_length("users"."nickname") between 1 and 20)
);
--> statement-breakpoint
CREATE TABLE "words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"difficulty" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_results" ADD CONSTRAINT "game_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_players" ADD CONSTRAINT "room_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_drawer_user_id_users_id_fk" FOREIGN KEY ("drawer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_word_id_words_id_fk" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_active_uniq" ON "room_players" USING btree ("room_id","user_id") WHERE left_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "room_players_seat_uniq" ON "room_players" USING btree ("room_id","seat_order");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_active_code_uniq" ON "rooms" USING btree ("code") WHERE status <> 'CLOSED';--> statement-breakpoint
CREATE UNIQUE INDEX "rounds_game_round_uniq" ON "rounds" USING btree ("game_id","round_number");--> statement-breakpoint
CREATE UNIQUE INDEX "scores_round_user_kind_uniq" ON "scores" USING btree ("round_id","user_id","kind") WHERE round_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "words_text_lower_uniq" ON "words" USING btree (lower("text"));