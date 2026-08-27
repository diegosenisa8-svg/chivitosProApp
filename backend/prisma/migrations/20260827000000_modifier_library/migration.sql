-- CreateTable
CREATE TABLE "ModifierLibraryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "min" INTEGER NOT NULL DEFAULT 0,
    "max" INTEGER NOT NULL DEFAULT 1,
    "allowQuantity" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierLibraryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierLibraryOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "ModifierLibraryOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryModifierAssignment" (
    "categoryId" TEXT NOT NULL,
    "libraryGroupId" TEXT NOT NULL,

    CONSTRAINT "CategoryModifierAssignment_pkey" PRIMARY KEY ("categoryId","libraryGroupId")
);

-- AddForeignKey
ALTER TABLE "ModifierLibraryOption" ADD CONSTRAINT "ModifierLibraryOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ModifierLibraryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryModifierAssignment" ADD CONSTRAINT "CategoryModifierAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryModifierAssignment" ADD CONSTRAINT "CategoryModifierAssignment_libraryGroupId_fkey" FOREIGN KEY ("libraryGroupId") REFERENCES "ModifierLibraryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
