ALTER TABLE "user_settings" ADD COLUMN "classifier_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;
