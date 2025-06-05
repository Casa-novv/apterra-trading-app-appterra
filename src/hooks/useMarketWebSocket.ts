import { useEffect, useRef, useState } from 'react';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  // Add more fields as needed
}

export function useMarketWebSocket(url: string) {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocket(url);

    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'market_data' || data.type === 'prices') {
        // Adapt this if your backend sends a different structure
        if (Array.isArray(data.market)) {
          setMarketData(data.market);
        } else if (data.prices) {
          // If backend sends { prices: { BTC: 123, ETH: 456, ... } }
          setMarketData(
            Object.entries(data.prices).map(([symbol, price]) => ({
              symbol,
              price: Number(price),
              change: 0, // You can add change if your backend provides it
            }))
          );
        }
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      wsRef.current?.close();
    };
  }, [url]);

  return marketData;
}