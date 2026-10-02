-- Add a private note visible only to administrators.
-- Existing orders are preserved and receive an empty note.
ALTER TABLE "Order" ADD COLUMN "adminNote" TEXT NOT NULL DEFAULT '';