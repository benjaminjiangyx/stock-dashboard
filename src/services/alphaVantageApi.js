const API_BASE_URL = "https://www.alphavantage.co/query";
const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;

// Cache configuration
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY_PREFIX = "stock_quote_";
const CHART_CACHE_PREFIX = "stock_chart_";

// Cache utilities
const getCachedData = (key) => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const isValid = Date.now() - timestamp < CACHE_DURATION;

    return isValid ? data : null;
  } catch (error) {
    console.warn("Cache read error:", error);
    return null;
  }
};

const setCachedData = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (error) {
    console.warn("Cache write error:", error);
  }
};

export const fetchQuote = async (symbol, useCache = true) => {
  // Check cache first
  const cacheKey = CACHE_KEY_PREFIX + symbol;
  if (useCache) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${symbol}`);
      return cached;
    }
  }

  const response = await fetch(
    `${API_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  // CRITICAL: Check for "Information" field (daily limit exhausted)
  if (data["Information"]) {
    throw new Error(
      "Alpha Vantage daily API limit (25 requests) exhausted. " +
        "Your free tier limit will reset in 24 hours. " +
        "Cached data may still be available - try refreshing the page."
    );
  }

  // Check for per-minute rate limiting
  if (data["Note"]) {
    throw new Error(
      "API call frequency limit reached (5 per minute maximum). " +
        "Please wait 60 seconds and try again."
    );
  }

  // Check for API errors (invalid symbol, etc.)
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  const quote = data["Global Quote"];
  if (!quote || !quote["05. price"]) {
    throw new Error(`No data available for ${symbol}`);
  }

  // Map Alpha Vantage response to our format
  const result = {
    symbol,
    price: parseFloat(quote["05. price"]),
    change: parseFloat(quote["10. change percent"].replace("%", "")),
    previousClose: parseFloat(quote["08. previous close"]),
    high: parseFloat(quote["03. high"]),
    low: parseFloat(quote["04. low"]),
    open: parseFloat(quote["02. open"]),
  };

  // Cache the result
  setCachedData(cacheKey, result);

  return result;
};

export const fetchMultipleQuotes = async (symbols, onProgress = null) => {
  try {
    const quotes = [];
    const BATCH_SIZE = 5;
    const WAIT_BETWEEN_BATCHES = 61000; // 61 seconds

    // Process in batches of 5 to respect rate limits (5 per minute)
    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      // If not the first batch, wait before proceeding
      if (i > 0) {
        if (onProgress) {
          onProgress({
            status: "waiting",
            message: `Waiting 60s for API rate limit...`,
            loaded: i,
            total: symbols.length,
            currentSymbol: "",
          });
        }
        await new Promise((resolve) =>
          setTimeout(resolve, WAIT_BETWEEN_BATCHES)
        );
      }

      // Fetch batch with minimal delays (500ms between each request)
      for (let j = 0; j < batch.length; j++) {
        const symbol = batch[j];
        const overallIndex = i + j;

        if (onProgress) {
          onProgress({
            status: "loading",
            currentSymbol: symbol,
            loaded: overallIndex,
            total: symbols.length,
            message: `Loading ${symbol}...`,
          });
        }

        const quote = await fetchQuote(symbol);
        quotes.push(quote);

        // Small delay between requests within batch (safety buffer)
        if (j < batch.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    return quotes;
  } catch (error) {
    throw new Error(`Error fetching quotes: ${error.message}`);
  }
};

export const fetchDailyTimeSeries = async (
  symbol,
  days = 30,
  useCache = true
) => {
  // Check cache first
  const cacheKey = CHART_CACHE_PREFIX + symbol + "_" + days;
  if (useCache) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log(`Cache hit for chart ${symbol}`);
      return cached;
    }
  }

  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch time series for ${symbol}: ${response.statusText}`
    );
  }

  const data = await response.json();

  // CRITICAL: Check for "Information" field (daily limit exhausted)
  if (data["Information"]) {
    throw new Error(
      "Alpha Vantage daily API limit (25 requests) exhausted. " +
        "Your free tier limit will reset in 24 hours. " +
        "Cached data may still be available - try refreshing the page."
    );
  }

  // Check for per-minute rate limiting
  if (data["Note"]) {
    throw new Error(
      "API call frequency limit reached (5 per minute maximum). " +
        "Please wait 60 seconds and try again."
    );
  }

  // Check for API errors (invalid symbol, etc.)
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  const timeSeries = data["Time Series (Daily)"];
  if (!timeSeries) {
    throw new Error(`No time series data available for ${symbol}`);
  }

  // Convert to array and sort by date
  const dates = Object.keys(timeSeries).sort().slice(-days);

  const result = dates.map((date) => ({
    date,
    timestamp: new Date(date).getTime() / 1000,
    open: parseFloat(timeSeries[date]["1. open"]),
    high: parseFloat(timeSeries[date]["2. high"]),
    low: parseFloat(timeSeries[date]["3. low"]),
    close: parseFloat(timeSeries[date]["4. close"]),
    volume: parseInt(timeSeries[date]["5. volume"]),
  }));

  // Cache the result
  setCachedData(cacheKey, result);

  return result;
};
