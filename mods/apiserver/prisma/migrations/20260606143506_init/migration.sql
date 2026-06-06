-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);
