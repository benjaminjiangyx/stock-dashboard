const API_BASE_URL = 'https://finnhub.io/api/v1';
const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export const fetchQuote = async (symbol) => {
  const response = await fetch(
    `${API_BASE_URL}/quote?symbol=${symbol}&token=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  // Check for API errors in response
  if (data.error) {
    throw new Error(data.error);
  }

  return data;
};

export const calculatePercentChange = (current, previous) => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

export const fetchMultipleQuotes = async (symbols) => {
  try {
    const quotes = await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await fetchQuote(symbol);
        return {
          symbol,
          price: quote.c,
          change: calculatePercentChange(quote.c, quote.pc),
          previousClose: quote.pc,
          high: quote.h,
          low: quote.l,
          open: quote.o,
        };
      })
    );
    return quotes;
  } catch (error) {
    throw new Error(`Error fetching quotes: ${error.message}`);
  }
};

export const fetchStockCandles = async (symbol, resolution = '5', daysBack = 7) => {
  const now = Math.floor(Date.now() / 1000);
  const from = now - (daysBack * 24 * 60 * 60);

  try {
    const response = await fetch(
      `${API_BASE_URL}/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${now}&token=${API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();

    if (data.s === 'no_data') {
      throw new Error(`No candle data available for ${symbol}. The market might be closed or data is unavailable.`);
    }

    if (data.error) {
      throw new Error(data.error);
    }

    // Filter to get only the most recent trading day's data
    if (data.t && data.t.length > 0) {
      // Get the most recent timestamp
      const lastTimestamp = data.t[data.t.length - 1];
      const lastDate = new Date(lastTimestamp * 1000);

      // Get the start of that trading day (assuming 9:30 AM ET market open)
      const dayStart = new Date(lastDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayStartTimestamp = Math.floor(dayStart.getTime() / 1000);

      // Filter data for just the most recent trading day
      const filteredIndices = [];
      for (let i = 0; i < data.t.length; i++) {
        if (data.t[i] >= dayStartTimestamp) {
          filteredIndices.push(i);
        }
      }

      // Return filtered data
      return {
        c: filteredIndices.map(i => data.c[i]),
        h: filteredIndices.map(i => data.h[i]),
        l: filteredIndices.map(i => data.l[i]),
        o: filteredIndices.map(i => data.o[i]),
        t: filteredIndices.map(i => data.t[i]),
        v: filteredIndices.map(i => data.v[i]),
        s: data.s,
      };
    }

    return data;
  } catch (error) {
    if (error.message.includes('fetch')) {
      throw new Error('Network error: Unable to reach Finnhub API');
    }
    throw error;
  }
};
