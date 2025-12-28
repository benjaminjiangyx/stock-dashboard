import { useState, useEffect, useCallback } from 'react';
import { fetchMultipleQuotes } from '../services/alphaVantageApi';

export const useStockData = (symbols) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({
    loaded: 0,
    total: 0,
    currentSymbol: '',
    status: '',
    message: ''
  });

  const fetchStocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress({
        loaded: 0,
        total: symbols.length,
        currentSymbol: '',
        status: 'loading',
        message: 'Starting...'
      });

      const quotes = await fetchMultipleQuotes(symbols, (progressInfo) => {
        setProgress(progressInfo);
      });

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

  return { stocks, loading, error, progress, refetch: fetchStocks };
};
