ALTER TABLE "users" ADD COLUMN "enrollment_id" TEXT; CREATE UNIQUE INDEX "users_enrollment_id_key" ON "users"("enrollment_id");
