-- Add a private note visible only to administrators.
-- Existing inquiries are preserved and receive an empty note.
ALTER TABLE "Inquiry" ADD COLUMN "adminNote" TEXT NOT NULL DEFAULT '';