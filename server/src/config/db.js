const dns = require('dns');
const mongoose = require('mongoose');
const { mongoUri } = require('./env');

// Some networks/ISPs block SRV lookups used by mongodb+srv:// URIs.
// Optional override: set DNS_SERVERS=8.8.8.8,1.1.1.1 in server/.env
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(',').map((s) => s.trim()));
}

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connected (database: ${mongoose.connection.name})`);
}

module.exports = connectDB;