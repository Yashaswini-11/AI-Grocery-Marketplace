const { prisma, Prisma } = require('../config/db');
const HttpError = require('../utils/HttpError');
const asyncHandler = require('../utils/asyncHandler');
const { CATEGORIES } = require('../utils/constants');
const { isUuid } = require('../utils/ids');
const { productDto } = require('../utils/serializers');

// Escape LIKE wildcards so "50%" is searched literally
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

// Shared by GET /products and GET /products/search
const listProducts = asyncHandler(async (req, res) => {
  const { category, q } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

  const conditions = [Prisma.sql`TRUE`];

  if (category) {
    if (!CATEGORIES.includes(category)) {
      throw new HttpError(400, `Category must be one of: ${CATEGORIES.join(', ')}`);
    }
    conditions.push(Prisma.sql`category = ${category}::"Category"`);
  }

  if (typeof q === 'string' && q.trim()) {
    const like = `%${escapeLike(q.trim().slice(0, 100))}%`;
    // Match the name, or any alias ("kela" finds Banana)
    conditions.push(
      Prisma.sql`(name ILIKE ${like} OR EXISTS (SELECT 1 FROM unnest(aliases) AS a WHERE a ILIKE ${like}))`
    );
  }

  const where = Prisma.join(conditions, ' AND ');

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw`SELECT id::text AS id FROM products WHERE ${where} ORDER BY name ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM products WHERE ${where}`,
  ]);

  const ids = idRows.map((r) => r.id);
  const rows = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } } }) : [];
  const byId = new Map(rows.map((p) => [p.id, p]));
  const products = ids.map((id) => productDto(byId.get(id)));
  const total = countRows[0].count;

  res.json({
    success: true,
    products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getProduct = asyncHandler(async (req, res) => {
  if (!isUuid(req.params.id)) throw new HttpError(400, 'Invalid product id');
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (!product) throw new HttpError(404, 'Product not found');
  res.json({ success: true, product: productDto(product) });
});

module.exports = { listProducts, getProduct };
