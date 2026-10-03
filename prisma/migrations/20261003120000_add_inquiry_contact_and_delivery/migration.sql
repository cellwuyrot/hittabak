-- Add checkout preferences without changing or deleting existing inquiries.
ALTER TABLE "Inquiry" ADD COLUMN "preferredContact" TEXT NOT NULL DEFAULT 'phone';
ALTER TABLE "Inquiry" ADD COLUMN "deliveryMethod" TEXT NOT NULL DEFAULT 'cdek';