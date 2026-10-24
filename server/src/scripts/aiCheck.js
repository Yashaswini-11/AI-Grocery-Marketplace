require('../config/env');
const { parseGroceryText } = require('../services/groceryParser');

async function run() {
  const text = 'I need 2 litres of milk, 1 kg of rice, 6 eggs, half a kg paneer, bananas and bread.';
  console.log('Input:', text);
  const result = await parseGroceryText(text);
  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error('AI check failed:', err.errorCode || err.name, '-', err.message);
  process.exit(1);
});