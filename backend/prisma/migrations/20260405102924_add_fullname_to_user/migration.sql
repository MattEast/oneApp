/*
  Warnings:

  - Added the required column `fullname` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- 1. Add column as nullable
ALTER TABLE "User" ADD COLUMN "fullname" TEXT;

-- 2. Set a default value for all existing users
UPDATE "User" SET "fullname" = 'Unknown User' WHERE "fullname" IS NULL;

-- 3. Alter column to be NOT NULL
ALTER TABLE "User" ALTER COLUMN "fullname" SET NOT NULL;
