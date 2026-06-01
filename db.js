const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'velocityx';

let client;
let cachedDb;

async function connectToDatabase() {
  if (!uri) {
    throw new Error('Missing MONGO_URI in environment. Add it to .env or set it in your hosting environment.');
  }

  if (cachedDb) {
    return cachedDb;
  }

  client = new MongoClient(uri);
  await client.connect();
  cachedDb = client.db(dbName);
  return cachedDb;
}

async function getDb() {
  if (!cachedDb) {
    return connectToDatabase();
  }
  return cachedDb;
}

async function getCollection(name) {
  if (!uri) {
    throw new Error('Missing MONGO_URI in environment. Database operations are unavailable.');
  }
  const db = await getDb();
  return db.collection(name);
}

module.exports = {
  connectToDatabase,
