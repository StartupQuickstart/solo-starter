-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- Prefixed nanoid generation at the database level.
--
-- A DB-side default (rather than app-side generation) covers every write
-- path uniformly: Prisma creates, nested creates, createMany, seeds, and
-- raw SQL. Prefixes make ids self-describing (usr_ user, note_ note,
-- evt_ webhook event); see the prisma/models/*.prisma defaults for the full
-- map.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

CREATE OR REPLACE FUNCTION app.nanoid(prefix text DEFAULT '', size int DEFAULT 21)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = app, public
AS $$
DECLARE
  alphabet constant text := '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  result text := '';
  bytes bytea;
  i int;
  byte_val int;
BEGIN
  WHILE length(result) < size LOOP
    bytes := public.gen_random_bytes(size);
    i := 0;
    WHILE i < size AND length(result) < size LOOP
      byte_val := get_byte(bytes, i);
      -- Rejection sampling: 248 = 62 * 4; discarding bytes >= 248 removes
      -- the modulo bias a plain `% 62` would introduce.
      IF byte_val < 248 THEN
        result := result || substr(alphabet, (byte_val % 62) + 1, 1);
      END IF;
      i := i + 1;
    END LOOP;
  END LOOP;
  RETURN prefix || result;
END;
$$;

-- CreateTable
CREATE TABLE "app"."clerk_webhook_events" (
    "id" TEXT NOT NULL DEFAULT app.nanoid('evt_'::text),
    "event_type" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "error" TEXT,

    CONSTRAINT "clerk_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."notes" (
    "id" TEXT NOT NULL DEFAULT app.nanoid('note_'::text),
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."stripe_webhook_events" (
    "id" TEXT NOT NULL DEFAULT app.nanoid('evt_'::text),
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "error" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."users" (
    "id" TEXT NOT NULL DEFAULT app.nanoid('usr_'::text),
    "clerk_id" TEXT NOT NULL,
    "email" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "last_sign_in_at" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "subscription_status" TEXT,
    "subscription_current_period_end" TIMESTAMP(3),
    "subscription_cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clerk_webhook_events_event_id_key" ON "app"."clerk_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "clerk_webhook_events_event_type_idx" ON "app"."clerk_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "clerk_webhook_events_object_id_idx" ON "app"."clerk_webhook_events"("object_id");

-- CreateIndex
CREATE INDEX "clerk_webhook_events_processed_at_idx" ON "app"."clerk_webhook_events"("processed_at");

-- CreateIndex
CREATE INDEX "notes_user_id_deleted_at_created_at_idx" ON "app"."notes"("user_id", "deleted_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_event_id_key" ON "app"."stripe_webhook_events"("event_id");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_event_type_idx" ON "app"."stripe_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processed_at_idx" ON "app"."stripe_webhook_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "app"."users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "app"."users"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "app"."users"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "app"."users"("deleted_at");

-- AddForeignKey
ALTER TABLE "app"."notes" ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
