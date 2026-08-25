-- CreateTable
CREATE TABLE "engine_lease" (
    "id" TEXT NOT NULL,
    "holder" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engine_lease_pkey" PRIMARY KEY ("id")
);
