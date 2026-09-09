-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_plate_key" ON "customer_profiles"("plate");

-- CreateIndex
CREATE INDEX "customer_profiles_plate_idx" ON "customer_profiles"("plate");
