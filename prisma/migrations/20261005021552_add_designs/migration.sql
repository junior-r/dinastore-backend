-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "design_id" TEXT,
ADD COLUMN     "design_placement" JSONB,
ADD COLUMN     "design_print_key" TEXT,
ADD COLUMN     "design_thumbnail_key" TEXT,
ADD COLUMN     "garment_image_url" TEXT;

-- CreateTable
CREATE TABLE "designs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "print_key" TEXT NOT NULL,
    "thumbnail_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "designs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "designs_user_id_idx" ON "designs"("user_id");

-- CreateIndex
CREATE INDEX "order_items_design_id_idx" ON "order_items"("design_id");

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
