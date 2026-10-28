-- Data-integrity rules Prisma cannot express in schema.prisma
ALTER TABLE "products"   ADD CONSTRAINT "products_stock_non_negative"  CHECK ("stock" >= 0);
ALTER TABLE "products"   ADD CONSTRAINT "products_price_non_negative"  CHECK ("price" >= 0);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_range"    CHECK ("quantity" BETWEEN 1 AND 99);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" >= 1);
