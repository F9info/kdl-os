-- Force password change on first login for seeded accounts (KDL-283)
ALTER TABLE "users" ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false;
