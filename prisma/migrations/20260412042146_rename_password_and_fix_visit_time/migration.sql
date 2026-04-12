-- RenameColumn
ALTER TABLE "salespersons" RENAME COLUMN "password" TO "password_hash";

-- AlterColumn: change visit_time from TEXT to TIME
ALTER TABLE "visit_records" ALTER COLUMN "visit_time" SET DATA TYPE TIME USING "visit_time"::TIME;
