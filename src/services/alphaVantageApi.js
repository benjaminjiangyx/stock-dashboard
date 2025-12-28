const API_BASE_URL = 'https://www.alphavantage.co/query';
const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;

export const fetchQuote = async (symbol) => {
  const response = await fetch(
    `${API_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note']) {
    throw new Error('API call frequency limit reached. Please try again later.');
  }

  const quote = data['Global Quote'];
  if (!quote || !quote['05. price']) {
    throw new Error(`No data available for ${symbol}`);
  }

  // Map Alpha Vantage response to our format
  return {
    symbol,
    price: parseFloat(quote['05. price']),
    change: parseFloat(quote['10. change percent'].replace('%', '')),
    previousClose: parseFloat(quote['08. previous close']),
    high: parseFloat(quote['03. high']),
    low: parseFloat(quote['04. low']),
    open: parseFloat(quote['02. open']),
  };
};

export const fetchMultipleQuotes = async (symbols) => {
  try {
    // Alpha Vantage free tier: 25 requests per day, 5 per minute
    // Add delay between requests to avoid rate limiting
    const quotes = [];
    for (const symbol of symbols) {
      const quote = await fetchQuote(symbol);
      quotes.push(quote);
      // Wait 12 seconds between requests (5 per minute max)
      if (symbols.indexOf(symbol) < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }
    return quotes;
  } catch (error) {
    throw new Error(`Error fetching quotes: ${error.message}`);
  }
};

export const fetchDailyTimeSeries = async (symbol, days = 30) => {
  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch time series for ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note']) {
    throw new Error('API call frequency limit reached. Please try again later.');
  }

  const timeSeries = data['Time Series (Daily)'];
  if (!timeSeries) {
    throw new Error(`No time series data available for ${symbol}`);
  }

  // Convert to array and sort by date
  const dates = Object.keys(timeSeries).sort().slice(-days);

  return dates.map(date => ({
    date,
    timestamp: new Date(date).getTime() / 1000,
    open: parseFloat(timeSeries[date]['1. open']),
    high: parseFloat(timeSeries[date]['2. high']),
    low: parseFloat(timeSeries[date]['3. low']),
    close: parseFloat(timeSeries[date]['4. close']),
    volume: parseInt(timeSeries[date]['5. volume']),
  }));
};

export const fetchIntradayTimeSeries = async (symbol, interval = '5min') => {
  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch intraday data for ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data['Error Message']) {
    throw new Error(data['Error Message']);
  }

  if (data['Note']) {
    throw new Error('API call frequency limit reached. Please try again later.');
  }

  const timeSeries = data[`Time Series (${interval})`];
  if (!timeSeries) {
    throw new Error(`No intraday data available for ${symbol}`);
  }

  // Convert to array and sort by timestamp
  const timestamps = Object.keys(timeSeries).sort();

  // Get only the most recent trading day
  const latestTimestamp = timestamps[timestamps.length - 1];
  const latestDate = latestTimestamp.split(' ')[0];

  const todayData = timestamps
    .filter(ts => ts.startsWith(latestDate))
    .map(timestamp => ({
      timestamp,
      time: new Date(timestamp).getTime() / 1000,
      open: parseFloat(timeSeries[timestamp]['1. open']),
      high: parseFloat(timeSeries[timestamp]['2. high']),
      low: parseFloat(timeSeries[timestamp]['3. low']),
      close: parseFloat(timeSeries[timestamp]['4. close']),
      volume: parseInt(timeSeries[timestamp]['5. volume']),
    }));

  return todayData;
};
