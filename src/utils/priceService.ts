// Create a dedicated price service
import axios from 'axios';

export const fetchMultiMarketPrices = async (positions: any[]) => {
  const prices: Record<string, number> = {};

  // Group symbols by market
  const cryptoSymbols = positions.filter(p => p.market === 'crypto').map(p => p.symbol);
  const forexSymbols = positions.filter(p => p.market === 'forex').map(p => p.symbol);
  const stockSymbols = positions.filter(p => p.market === 'stocks').map(p => p.symbol);
  const commoditySymbols = positions.filter(p => p.market === 'commodities').map(p => p.symbol);

  // Crypto (Binance) - Add error handling and logging
  for (const symbol of cryptoSymbols) {
    try {
      console.log(`Fetching crypto price for: ${symbol}`);
      const res = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      prices[symbol] = Number(res.data.price);
      console.log(`${symbol} price: ${prices[symbol]}`);
    } catch (error) {
      console.error(`Failed to fetch crypto price for ${symbol}:`, error);
      prices[symbol] = NaN;
    }
  }

  // Forex - Fix the API structure
  for (const symbol of forexSymbols) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    try {
      console.log(`Fetching forex price for: ${symbol} (${base}/${quote})`);
      const res = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`);
      if (res.data.rates && res.data.rates[quote]) {
        prices[symbol] = res.data.rates[quote];
        console.log(`${symbol} price: ${prices[symbol]}`);
      } else {
        console.error(`No rate found for ${symbol}`);
        prices[symbol] = NaN;
      }
    } catch (error) {
      console.error(`Failed to fetch forex price for ${symbol}:`, error);
      prices[symbol] = NaN;
    }
  }

  // Stocks - Add CORS proxy and better error handling
  for (const symbol of stockSymbols) {
    try {
      console.log(`Fetching stock price for: ${symbol}`);
      // Yahoo Finance often blocks CORS, consider using a proxy or alternative API
      const res = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const quote = res.data.quoteResponse.result[0];
      if (quote && quote.regularMarketPrice) {
        prices[symbol] = quote.regularMarketPrice;
        console.log(`${symbol} price: ${prices[symbol]}`);
      } else {
        console.error(`No price data for ${symbol}`);
        prices[symbol] = NaN;
      }
    } catch (error) {
      console.error(`Failed to fetch stock price for ${symbol}:`, error);
      prices[symbol] = NaN;
    }
  }

  // Commodities - Similar to forex
  for (const symbol of commoditySymbols) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3, 6);
    try {
      console.log(`Fetching commodity price for: ${symbol} (${base}/${quote})`);
      const res = await axios.get(`https://api.exchangerate.host/latest?base=${base}&symbols=${quote}`);
      if (res.data.rates && res.data.rates[quote]) {
        prices[symbol] = res.data.rates[quote];
        console.log(`${symbol} price: ${prices[symbol]}`);
      } else {
        prices[symbol] = NaN;
      }
    } catch (error) {
      console.error(`Failed to fetch commodity price for ${symbol}:`, error);
      prices[symbol] = NaN;
    }
  }

  console.log('All fetched prices:', prices);
  return prices;
};