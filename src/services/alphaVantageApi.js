const API_BASE_URL = "https://www.alphavantage.co/query";
const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;

// Cache configuration
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_KEY_PREFIX = "stock_quote_";
const CHART_CACHE_PREFIX = "stock_chart_";
const LISTING_CACHE_KEY = "stock_listing_status";
const LISTING_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

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

export const fetchListingStatus = async () => {
  // Check cache first - use longer cache duration for listing data
  const cached = localStorage.getItem(LISTING_CACHE_KEY);
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      const isValid = Date.now() - timestamp < LISTING_CACHE_DURATION;

      if (isValid) {
        console.log('Cache hit for listing status');
        return data;
      }
    } catch (error) {
      console.warn('Cache read error for listing status:', error);
    }
  }

  console.log('Fetching listing status from API...');
  const response = await fetch(
    `${API_BASE_URL}?function=LISTING_STATUS&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch listing status: ${response.statusText}`);
  }

  // The response is a CSV file
  const csvText = await response.text();

  // Parse CSV to array of objects
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');

  // Check for API errors in the FIRST line only (not in company names)
  const firstLine = lines[0] || '';
  if (firstLine.includes('Error Message') || firstLine.includes('Information') || firstLine.includes('Note:')) {
    console.error('API Error Response:', csvText.substring(0, 500));
    throw new Error('API limit reached or error occurred');
  }

  console.log('CSV Headers:', headers);
  console.log('First data line:', lines[1]);
  console.log('Total lines:', lines.length);

  const listings = lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index];
    });
    return obj;
  }).filter(listing =>
    // Only include active US stocks
    listing.assetType === 'Stock' &&
    (listing.exchange === 'NASDAQ' || listing.exchange === 'NYSE' || listing.exchange === 'AMEX')
  ).map(listing => ({
    symbol: listing.symbol,
    name: listing.name
  }));

  console.log('Listings before filter:', lines.length - 1);
  console.log('Listings after filter:', listings.length);
  console.log('Sample listing:', listings[0]);

  // Don't cache if no valid listings found
  if (listings.length === 0) {
    console.error('No listings found after filtering. Headers:', headers);
    throw new Error('No valid listings found');
  }

  // Cache the result
  try {
    localStorage.setItem(
      LISTING_CACHE_KEY,
      JSON.stringify({ data: listings, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn('Cache write error for listing status:', error);
  }

  return listings;
};
