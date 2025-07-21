const supabase = require('./supabaseClient');
const redis = require('./redisClient');

async function publishSignal(signal) {
  // Store in Supabase
  await supabase.from('signals').insert([signal]);

  // Cache in Redis
  await redis.set(`signal:${signal.id}`, JSON.stringify(signal));

  // Publish to Redis channel
  await redis.publish('signals', JSON.stringify(signal));
}

module.exports = { publishSignal }; 