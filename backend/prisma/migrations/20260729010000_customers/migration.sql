-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 1,
    "lastOrderAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneKey_key" ON "Customer"("phoneKey");
