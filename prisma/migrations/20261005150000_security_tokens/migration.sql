PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
 "id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "password" TEXT NOT NULL, "name" TEXT NOT NULL DEFAULT '', "lastName" TEXT NOT NULL DEFAULT '', "phone" TEXT NOT NULL DEFAULT '', "address" TEXT NOT NULL DEFAULT '', "zipCode" TEXT NOT NULL DEFAULT '', "region" TEXT NOT NULL DEFAULT '', "city" TEXT NOT NULL DEFAULT '', "street" TEXT NOT NULL DEFAULT '', "building" TEXT NOT NULL DEFAULT '', "apartment" TEXT NOT NULL DEFAULT '', "sessionVersion" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("id","email","password","name","lastName","phone","address","zipCode","region","city","street","building","apartment","createdAt") SELECT "id","email","password","name","lastName","phone","address","zipCode","region","city","street","building","apartment","createdAt" FROM "User";
DROP TABLE "User"; ALTER TABLE "new_User" RENAME TO "User"; CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
DROP TABLE IF EXISTS "EmailVerification";
CREATE TABLE "EmailVerification" ("id" TEXT NOT NULL PRIMARY KEY,"email" TEXT NOT NULL,"purpose" TEXT NOT NULL DEFAULT 'registration',"code" TEXT,"codeHash" TEXT,"proofHash" TEXT,"expiresAt" DATETIME NOT NULL,"verifiedAt" DATETIME,"consumedAt" DATETIME,"attempts" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "EmailVerification_proofHash_key" ON "EmailVerification"("proofHash"); CREATE INDEX "EmailVerification_email_purpose_createdAt_idx" ON "EmailVerification"("email","purpose","createdAt");
CREATE TABLE "PasswordResetToken" ("id" TEXT NOT NULL PRIMARY KEY,"userId" TEXT NOT NULL,"tokenHash" TEXT NOT NULL,"purpose" TEXT NOT NULL DEFAULT 'password-reset',"expiresAt" DATETIME NOT NULL,"consumedAt" DATETIME,"attempts" INTEGER NOT NULL DEFAULT 0,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash"); CREATE INDEX "PasswordResetToken_userId_purpose_createdAt_idx" ON "PasswordResetToken"("userId","purpose","createdAt");
ALTER TABLE "ContactMessage" ADD COLUMN "retentionUntil" DATETIME;
PRAGMA foreign_keys=ON;
