import { useState, useEffect, useCallback } from 'react';
import { fetchMultipleQuotes } from '../services/alphaVantageApi';

export const useStockData = (symbols) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const quotes = await fetchMultipleQuotes(symbols);
      setStocks(quotes);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stock data:', err);
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  return { stocks, loading, error, refetch: fetchStocks };
};
