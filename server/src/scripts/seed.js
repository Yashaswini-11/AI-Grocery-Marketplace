require('../config/env');
const { prisma, connectDB, disconnectDB } = require('../config/db');

const img = (name) => `https://placehold.co/600x400?text=${encodeURIComponent(name)}`;

// price = INR per one `unit`
const products = [
  // Fruits
  { name: 'Banana', category: 'Fruits', price: 60, unit: 'kg', stock: 120, aliases: ['bananas', 'kela'], description: 'Ripe yellow bananas, sold per kg.' },
  { name: 'Apple', category: 'Fruits', price: 180, unit: 'kg', stock: 80, aliases: ['apples', 'seb'], description: 'Crisp red apples.' },
  { name: 'Orange', category: 'Fruits', price: 90, unit: 'kg', stock: 90, aliases: ['oranges'], description: 'Juicy sweet oranges.' },
  { name: 'Grapes', category: 'Fruits', price: 110, unit: 'kg', stock: 60, aliases: ['grape'], description: 'Seedless green grapes.' },
  { name: 'Pomegranate', category: 'Fruits', price: 190, unit: 'kg', stock: 50, aliases: ['anar'], description: 'Ruby red pomegranates.' },
  { name: 'Pineapple', category: 'Fruits', price: 70, unit: 'piece', stock: 40, aliases: ['pineapples', 'ananas'], description: 'Sweet ripe pineapple, sold per piece.' },
  { name: 'Papaya', category: 'Fruits', price: 60, unit: 'kg', stock: 50, aliases: ['papaya fruit', 'papita'], description: 'Ripe sweet papaya.' },
  { name: 'Watermelon', category: 'Fruits', price: 35, unit: 'kg', stock: 60, aliases: ['tarbooz'], description: 'Juicy red watermelon.' },
  { name: 'Guava', category: 'Fruits', price: 80, unit: 'kg', stock: 50, aliases: ['amrood', 'peru'], description: 'Fresh green guavas.' },
  { name: 'Lemon', category: 'Fruits', price: 120, unit: 'kg', stock: 60, aliases: ['lemons', 'nimbu', 'lime'], description: 'Tangy fresh lemons.' },

  // Vegetables
  { name: 'Tomato', category: 'Vegetables', price: 40, unit: 'kg', stock: 150, aliases: ['tomatoes', 'tamatar'], description: 'Fresh red tomatoes.' },
  { name: 'Onion', category: 'Vegetables', price: 45, unit: 'kg', stock: 200, aliases: ['onions', 'pyaz'], description: 'Everyday red onions.' },
  { name: 'Potato', category: 'Vegetables', price: 35, unit: 'kg', stock: 200, aliases: ['potatoes', 'aloo'], description: 'Fresh potatoes.' },
  { name: 'Carrot', category: 'Vegetables', price: 60, unit: 'kg', stock: 100, aliases: ['carrots', 'gajar'], description: 'Sweet orange carrots.' },
  { name: 'Spinach (1 bunch)', category: 'Vegetables', price: 25, unit: 'piece', stock: 70, aliases: ['spinach', 'palak'], description: 'Fresh leafy spinach, one bunch.' },
  { name: 'Cucumber', category: 'Vegetables', price: 40, unit: 'kg', stock: 90, aliases: ['cucumbers', 'kheera'], description: 'Crisp green cucumbers.' },
  { name: 'Cauliflower', category: 'Vegetables', price: 45, unit: 'piece', stock: 60, aliases: ['gobi', 'phool gobi'], description: 'Fresh white cauliflower, sold per piece.' },
  { name: 'Capsicum', category: 'Vegetables', price: 80, unit: 'kg', stock: 70, aliases: ['bell pepper', 'green pepper', 'shimla mirch'], description: 'Green capsicum.' },
  { name: 'Ginger', category: 'Vegetables', price: 200, unit: 'kg', stock: 40, aliases: ['adrak'], description: 'Fresh ginger root.' },
  { name: 'Garlic', category: 'Vegetables', price: 250, unit: 'kg', stock: 40, aliases: ['lehsun', 'bellulli'], description: 'Fresh garlic bulbs.' },
  { name: 'Brinjal', category: 'Vegetables', price: 50, unit: 'kg', stock: 70, aliases: ['eggplant', 'aubergine', 'baingan'], description: 'Purple brinjal.' },
  { name: 'Coriander Leaves (1 bunch)', category: 'Vegetables', price: 15, unit: 'piece', stock: 80, aliases: ['coriander', 'cilantro', 'dhania'], description: 'Fresh coriander, one bunch.' },

  // Dairy
  { name: 'Full Cream Milk', category: 'Dairy', price: 68, unit: 'litre', stock: 100, aliases: ['milk', 'doodh'], description: 'Pasteurised full cream milk.' },
  { name: 'Curd', category: 'Dairy', price: 90, unit: 'kg', stock: 60, aliases: ['yogurt', 'yoghurt', 'dahi'], description: 'Fresh set curd.' },
  { name: 'Paneer', category: 'Dairy', price: 380, unit: 'kg', stock: 30, aliases: ['cottage cheese'], description: 'Soft fresh paneer.' },
  { name: 'Butter (100 g pack)', category: 'Dairy', price: 58, unit: 'piece', stock: 80, aliases: ['butter'], description: 'Salted table butter, 100 g pack.' },
  { name: 'Eggs', category: 'Dairy', price: 7, unit: 'piece', stock: 300, aliases: ['egg', 'anda'], description: 'Farm eggs, priced per egg.' },
  { name: 'Cheese Slices (200 g pack)', category: 'Dairy', price: 140, unit: 'piece', stock: 60, aliases: ['cheese', 'cheese slice'], description: 'Processed cheese slices, 200 g pack.' },
  { name: 'Ghee (500 ml)', category: 'Dairy', price: 320, unit: 'piece', stock: 40, aliases: ['ghee', 'clarified butter'], description: 'Pure cow ghee, 500 ml jar.' },
  { name: 'Buttermilk (500 ml pack)', category: 'Dairy', price: 20, unit: 'piece', stock: 80, aliases: ['buttermilk', 'chaas', 'majjige'], description: 'Spiced buttermilk, 500 ml pack.' },

  // Grains
  { name: 'Basmati Rice', category: 'Grains', price: 120, unit: 'kg', stock: 150, aliases: ['rice', 'chawal'], description: 'Long-grain aged basmati rice.' },
  { name: 'Wheat Flour (Atta)', category: 'Grains', price: 48, unit: 'kg', stock: 150, aliases: ['atta', 'wheat flour', 'flour'], description: 'Whole wheat chakki atta.' },
  { name: 'Toor Dal', category: 'Grains', price: 150, unit: 'kg', stock: 100, aliases: ['toor', 'arhar', 'tur dal', 'lentils'], description: 'Split pigeon peas.' },
  { name: 'Moong Dal', category: 'Grains', price: 140, unit: 'kg', stock: 80, aliases: ['moong', 'mung dal', 'lentils'], description: 'Split yellow moong lentils.' },
  { name: 'Chana Dal', category: 'Grains', price: 110, unit: 'kg', stock: 80, aliases: ['chana', 'bengal gram'], description: 'Split Bengal gram.' },
  { name: 'Besan (Gram Flour)', category: 'Grains', price: 95, unit: 'kg', stock: 60, aliases: ['besan', 'gram flour'], description: 'Fine gram flour.' },
  { name: 'Poha', category: 'Grains', price: 70, unit: 'kg', stock: 80, aliases: ['flattened rice', 'aval'], description: 'Thick flattened rice for breakfast.' },
  { name: 'Sunflower Oil', category: 'Grains', price: 150, unit: 'litre', stock: 100, aliases: ['oil', 'cooking oil', 'refined oil'], description: 'Refined sunflower cooking oil.' },
  { name: 'Salt', category: 'Grains', price: 25, unit: 'kg', stock: 150, aliases: ['namak', 'iodised salt'], description: 'Iodised table salt.' },
  { name: 'Sugar', category: 'Grains', price: 48, unit: 'kg', stock: 150, aliases: ['cheeni'], description: 'Refined white sugar.' },
  { name: 'Turmeric Powder (100 g pack)', category: 'Grains', price: 35, unit: 'piece', stock: 100, aliases: ['turmeric', 'haldi'], description: 'Pure turmeric powder, 100 g pack.' },
  { name: 'Tea Powder (250 g pack)', category: 'Grains', price: 130, unit: 'piece', stock: 80, aliases: ['tea', 'chai', 'chai patti'], description: 'Strong CTC tea powder, 250 g pack.' },
  { name: 'Sandwich Bread (400 g loaf)', category: 'Grains', price: 45, unit: 'piece', stock: 60, aliases: ['bread', 'sandwich bread'], description: 'Soft sliced white bread loaf.' },

  // Snacks
  { name: 'Potato Chips (pack)', category: 'Snacks', price: 20, unit: 'piece', stock: 150, aliases: ['chips', 'crisps'], description: 'Salted potato chips.' },
  { name: 'Marie Biscuits (pack)', category: 'Snacks', price: 25, unit: 'piece', stock: 120, aliases: ['biscuits', 'biscuit', 'cookies'], description: 'Light tea-time biscuits.' },
  { name: 'Roasted Peanuts (200 g pack)', category: 'Snacks', price: 40, unit: 'piece', stock: 90, aliases: ['peanuts', 'groundnuts'], description: 'Salted roasted peanuts.' },
  { name: 'Instant Noodles (pack)', category: 'Snacks', price: 14, unit: 'piece', stock: 200, aliases: ['noodles'], description: 'Masala instant noodles.' },
  { name: 'Namkeen Mixture (200 g pack)', category: 'Snacks', price: 55, unit: 'piece', stock: 100, aliases: ['namkeen', 'mixture', 'bhujia'], description: 'Crunchy savoury snack mix.' },
  { name: 'Milk Chocolate Bar', category: 'Snacks', price: 50, unit: 'piece', stock: 120, aliases: ['chocolate', 'choco'], description: 'Smooth milk chocolate bar.' },

  // Household
  { name: 'Dishwash Liquid (500 ml)', category: 'Household', price: 99, unit: 'piece', stock: 70, aliases: ['dishwash', 'dish soap'], description: 'Lemon dishwashing liquid.' },
  { name: 'Laundry Detergent (1 kg)', category: 'Household', price: 140, unit: 'piece', stock: 60, aliases: ['detergent', 'washing powder'], description: 'Detergent powder for machine and hand wash.' },
  { name: 'Toilet Paper Roll', category: 'Household', price: 60, unit: 'piece', stock: 100, aliases: ['toilet paper', 'tissue'], description: '2-ply soft toilet paper roll.' },
  { name: 'Hand Wash (250 ml)', category: 'Household', price: 85, unit: 'piece', stock: 80, aliases: ['handwash', 'hand soap'], description: 'Antibacterial liquid hand wash.' },
  { name: 'Floor Cleaner (1 litre)', category: 'Household', price: 165, unit: 'piece', stock: 60, aliases: ['floor cleaner', 'cleaner', 'phenyl'], description: 'Disinfectant floor cleaner, 1 litre bottle.' },
  { name: 'Toothpaste (100 g)', category: 'Household', price: 65, unit: 'piece', stock: 90, aliases: ['toothpaste', 'tooth paste'], description: 'Fluoride toothpaste, 100 g tube.' },
].map((p) => ({ ...p, imageUrl: img(p.name) }));

async function seed() {
  const reset = process.argv.includes('--reset');
  await connectDB();

  if (reset) {
    // Wipes the whole shop (carts and orders reference products). Development only.
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.product.deleteMany();
    const created = await prisma.product.createMany({ data: products });
    console.log(`Reset: seeded ${created.count} products`);
  } else {
    // Safe sync: adds missing products, updates the others, never touches existing stock.
    // Each product is its own small write, so a slow remote database cannot hit a transaction
    // time limit. Re-running is always safe: a product that already exists is simply updated.
    const before = await prisma.product.count();
    for (const { stock, ...rest } of products) {
      await prisma.product.upsert({
        where: { name: rest.name },
        update: rest,
        create: { ...rest, stock },
      });
    }
    const after = await prisma.product.count();
    console.log(`Catalog synced: ${after - before} added, ${products.length} checked (existing stock kept)`);
  }

  console.log(`Total products in database: ${await prisma.product.count()}`);
  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await disconnectDB();
  process.exit(1);
});