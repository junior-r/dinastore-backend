-- CreateTable
CREATE TABLE "_ProductImageVariants" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductImageVariants_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ProductImageVariants_B_index" ON "_ProductImageVariants"("B");

-- AddForeignKey
ALTER TABLE "_ProductImageVariants" ADD CONSTRAINT "_ProductImageVariants_A_fkey" FOREIGN KEY ("A") REFERENCES "product_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductImageVariants" ADD CONSTRAINT "_ProductImageVariants_B_fkey" FOREIGN KEY ("B") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
