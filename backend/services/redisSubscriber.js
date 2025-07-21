const { Redis } = require('@upstash/redis');

const subscriber = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function listenForSignals(onSignal) {
  await subscriber.subscribe('signals', (message) => {
    const signal = JSON.parse(message);
    onSignal(signal);
  });
}

module.exports = { listenForSignals }; 