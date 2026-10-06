-- CreateTable
CREATE TABLE "product_views" (
    "id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "user_id" TEXT,
    "visitor_id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "country" TEXT,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "favorited" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_views_started_at_idx" ON "product_views"("started_at");

-- CreateIndex
CREATE INDEX "product_views_product_id_started_at_idx" ON "product_views"("product_id", "started_at");

-- CreateIndex
CREATE INDEX "product_views_user_id_idx" ON "product_views"("user_id");

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
