import { getCacheDuration } from "../utils/marketHours";

const API_BASE_URL = "https://www.alphavantage.co/query";
const API_KEY = (import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || "").trim();
const PLACEHOLDER_KEYS = new Set(["", "DISABLED", "YOUR_API_KEY", "CHANGEME"]);

const ensureApiKeyConfigured = () => {
  if (!API_KEY || PLACEHOLDER_KEYS.has(API_KEY.toUpperCase())) {
    throw new Error(
      "Alpha Vantage API key is missing. Set VITE_ALPHA_VANTAGE_API_KEY in your .env file."
    );
  }
};

const parseInformationMessage = (info) => {
  if (!info) return null;
  const trimmed = info.trim();
  if (!trimmed) return null;

  // Sanitize API key from error messages
  return trimmed.replace(/[A-Z0-9]{16,}/g, '[API_KEY]');
};

// Cache configuration
const CACHE_KEY_PREFIX = "stock_quote_";
const CHART_CACHE_PREFIX = "stock_chart_";
const LISTING_CACHE_KEY = "stock_listing_status";
const LISTING_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days

// Rate limiting: 1 request per second
let lastApiCallTime = 0;
const MIN_API_CALL_INTERVAL = 1200; // 1.2 seconds to be safe

const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  if (timeSinceLastCall < MIN_API_CALL_INTERVAL) {
    const waitTime = MIN_API_CALL_INTERVAL - timeSinceLastCall;
    console.log(`[API] Rate limit: waiting ${waitTime}ms before next request`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastApiCallTime = Date.now();
};

// Cache utilities
const getCachedData = (key, cacheType = "quote") => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) {
      console.log(`No cache found for ${key} (${cacheType})`);
      return null;
    }

    const { data, timestamp } = JSON.parse(cached);

    // Calculate dynamic cache duration based on type and market status
    const cacheDuration = getCacheDuration(cacheType, timestamp);
    const age = Date.now() - timestamp;
    const isValid = age < cacheDuration;

    // Debug logging
    if (isValid) {
      console.log(
        `Cache hit for ${key} (${cacheType}): age=${Math.floor(
          age / 1000
        )}s, max=${Math.floor(cacheDuration / 1000)}s`
      );
    } else {
      console.log(
        `Cache expired for ${key} (${cacheType}): age=${Math.floor(
          age / 1000
        )}s, max=${Math.floor(cacheDuration / 1000)}s`
      );
    }

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
    const cached = getCachedData(cacheKey, "quote");
    if (cached) {
      return cached;
    }
  } else {
    console.log(`Bypassing cache for ${symbol} - fetching fresh data`);
  }

  ensureApiKeyConfigured();

  // Wait for rate limit before making API call
  await waitForRateLimit();

  const response = await fetch(
    `${API_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ${symbol}: ${response.statusText}`);
  }

  const data = await response.json();

  const infoMessage = parseInformationMessage(data["Information"]);
  if (infoMessage) {
    throw new Error(infoMessage);
  }

  const noteMessage = parseInformationMessage(data["Note"]);
  if (noteMessage) {
    throw new Error(noteMessage);
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

export const fetchMultipleQuotes = async (
  symbols,
  onProgress = null,
  useCache = true
) => {
  const quotes = [];
  const errors = [];

  // Fetch symbols one at a time (rate limiting handled automatically by fetchQuote)
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    if (onProgress) {
      onProgress({
        status: "loading",
        currentSymbol: symbol,
        loaded: i,
        total: symbols.length,
        message: `Loading ${symbol}...`,
      });
    }

    try {
      const quote = await fetchQuote(symbol, useCache);
      quotes.push(quote);
    } catch (error) {
      console.warn(`Failed to fetch ${symbol}:`, error.message);
      errors.push({ symbol, error: error.message });
    }
  }

  // If we got some quotes, return them even if some failed
  if (quotes.length > 0) {
    if (errors.length > 0) {
      console.warn(
        `Successfully loaded ${quotes.length}/${
          symbols.length
        } stocks. Failed: ${errors.map((e) => e.symbol).join(", ")}`
      );
    }
    return quotes;
  }

  // If ALL quotes failed, throw an error
  if (errors.length > 0) {
    throw new Error(`Error fetching quotes: ${errors[0].error}`);
  }

  return quotes;
};

export const fetchDailyTimeSeries = async (symbol, useCache = true) => {
  // Check cache first
  const cacheKey = CHART_CACHE_PREFIX + symbol;
  if (useCache) {
    const cached = getCachedData(cacheKey, "chart");
    if (cached) {
      console.log(`[API] Cache hit for chart ${symbol}`);
      return cached;
    } else {
      console.log(`[API] Cache miss for chart ${symbol}, will fetch from API`);
    }
  } else {
    console.log(
      `[API] Bypassing cache for chart ${symbol} - fetching fresh data`
    );
  }

  ensureApiKeyConfigured();

  // Wait for rate limit before making API call
  await waitForRateLimit();

  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch time series for ${symbol}: ${response.statusText}`
    );
  }

  const data = await response.json();

  const infoMessage = parseInformationMessage(data["Information"]);
  if (infoMessage) {
    throw new Error(infoMessage);
  }

  const noteMessage = parseInformationMessage(data["Note"]);
  if (noteMessage) {
    throw new Error(noteMessage);
  }

  // Check for API errors (invalid symbol, etc.)
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  const timeSeries = data["Time Series (Daily)"];
  if (!timeSeries) {
    throw new Error(`No time series data available for ${symbol}`);
  }

  // Convert to array and sort by date (API returns up to 100 days)
  const dates = Object.keys(timeSeries).sort();

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
  console.log(`[API] Caching chart data for ${symbol}`);
  setCachedData(cacheKey, result);

  return result;
};

export const fetchWeeklyTimeSeries = async (symbol, useCache = true) => {
  // Check cache first
  const cacheKey = CHART_CACHE_PREFIX + "weekly_" + symbol;
  if (useCache) {
    const cached = getCachedData(cacheKey, "chart_weekly");
    if (cached) {
      console.log(`[API] Cache hit for weekly chart ${symbol}`);
      return cached;
    } else {
      console.log(
        `[API] Cache miss for weekly chart ${symbol}, will fetch from API`
      );
    }
  } else {
    console.log(
      `[API] Bypassing cache for weekly chart ${symbol} - fetching fresh data`
    );
  }

  ensureApiKeyConfigured();

  // Wait for rate limit before making API call
  await waitForRateLimit();

  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_WEEKLY_ADJUSTED&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch weekly time series for ${symbol}: ${response.statusText}`
    );
  }

  const data = await response.json();

  const infoMessage = parseInformationMessage(data["Information"]);
  if (infoMessage) {
    throw new Error(infoMessage);
  }

  const noteMessage = parseInformationMessage(data["Note"]);
  if (noteMessage) {
    throw new Error(noteMessage);
  }

  // Check for API errors (invalid symbol, etc.)
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  const timeSeries = data["Weekly Adjusted Time Series"];
  if (!timeSeries) {
    throw new Error(`No weekly time series data available for ${symbol}`);
  }

  // Convert to array and sort by date (API returns 20+ years of data)
  const dates = Object.keys(timeSeries).sort();

  const result = dates.map((date) => {
    const open = parseFloat(timeSeries[date]["1. open"]);
    const high = parseFloat(timeSeries[date]["2. high"]);
    const low = parseFloat(timeSeries[date]["3. low"]);
    const close = parseFloat(timeSeries[date]["4. close"]);
    const adjustedClose = parseFloat(timeSeries[date]["5. adjusted close"]);
    const volume = parseInt(timeSeries[date]["6. volume"]);

    // Calculate adjustment factor to apply consistently to all OHLC values
    const adjustmentFactor = adjustedClose / close;

    return {
      date,
      timestamp: new Date(date).getTime() / 1000,
      open: open * adjustmentFactor,
      high: high * adjustmentFactor,
      low: low * adjustmentFactor,
      close: adjustedClose,
      volume: volume,
    };
  });

  // Cache the result
  console.log(`[API] Caching weekly chart data for ${symbol}`);
  setCachedData(cacheKey, result);

  return result;
};

export const fetchMonthlyTimeSeries = async (symbol, useCache = true) => {
  // Check cache first
  const cacheKey = CHART_CACHE_PREFIX + "monthly_" + symbol;
  if (useCache) {
    const cached = getCachedData(cacheKey, "chart_monthly");
    if (cached) {
      console.log(`[API] Cache hit for monthly chart ${symbol}`);
      return cached;
    } else {
      console.log(
        `[API] Cache miss for monthly chart ${symbol}, will fetch from API`
      );
    }
  } else {
    console.log(
      `[API] Bypassing cache for monthly chart ${symbol} - fetching fresh data`
    );
  }

  ensureApiKeyConfigured();

  // Wait for rate limit before making API call
  await waitForRateLimit();

  const response = await fetch(
    `${API_BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${symbol}&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch monthly time series for ${symbol}: ${response.statusText}`
    );
  }

  const data = await response.json();

  const infoMessage = parseInformationMessage(data["Information"]);
  if (infoMessage) {
    throw new Error(infoMessage);
  }

  const noteMessage = parseInformationMessage(data["Note"]);
  if (noteMessage) {
    throw new Error(noteMessage);
  }

  // Check for API errors (invalid symbol, etc.)
  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  const timeSeries = data["Monthly Adjusted Time Series"];
  if (!timeSeries) {
    throw new Error(`No monthly time series data available for ${symbol}`);
  }

  // Convert to array and sort by date (API returns 20+ years of data)
  const dates = Object.keys(timeSeries).sort();

  const result = dates.map((date) => {
    const open = parseFloat(timeSeries[date]["1. open"]);
    const high = parseFloat(timeSeries[date]["2. high"]);
    const low = parseFloat(timeSeries[date]["3. low"]);
    const close = parseFloat(timeSeries[date]["4. close"]);
    const adjustedClose = parseFloat(timeSeries[date]["5. adjusted close"]);
    const volume = parseInt(timeSeries[date]["6. volume"]);
    // Note: "7. dividend amount" is available but we're ignoring per requirements

    // Calculate adjustment factor to apply consistently to all OHLC values
    const adjustmentFactor = adjustedClose / close;

    return {
      date,
      timestamp: new Date(date).getTime() / 1000,
      open: open * adjustmentFactor,
      high: high * adjustmentFactor,
      low: low * adjustmentFactor,
      close: adjustedClose,
      volume: volume,
    };
  });

  // Cache the result
  console.log(`[API] Caching monthly chart data for ${symbol}`);
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
        console.log("Cache hit for listing status");
        return data;
      }
    } catch (error) {
      console.warn("Cache read error for listing status:", error);
    }
  }

  ensureApiKeyConfigured();

  // Wait for rate limit before making API call
  await waitForRateLimit();

  console.log("Fetching listing status from API...");
  const response = await fetch(
    `${API_BASE_URL}?function=LISTING_STATUS&apikey=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch listing status: ${response.statusText}`);
  }

  // The response is a CSV file
  const csvText = await response.text();

  // Parse CSV to array of objects
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",");

  // Check for API errors in the FIRST line only (not in company names)
  const firstLine = lines[0] || "";
  if (
    firstLine.includes("Error Message") ||
    firstLine.includes("Information") ||
    firstLine.includes("Note:")
  ) {
    console.error("API Error Response:", csvText.substring(0, 500));
    throw new Error("API limit reached or error occurred");
  }

  console.log("CSV Headers:", headers);
  console.log("First data line:", lines[1]);
  console.log("Total lines:", lines.length);

  const listings = lines
    .slice(1)
    .map((line) => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = values[index];
      });
      return obj;
    })
    .filter(
      (listing) =>
        // Include US stocks and ETFs
        (listing.assetType === "Stock" || listing.assetType === "ETF") &&
        (listing.exchange === "NASDAQ" ||
          listing.exchange === "NYSE" ||
          listing.exchange === "AMEX")
    )
    .map((listing) => ({
      symbol: listing.symbol,
      name: listing.name,
    }));

  console.log("Listings before filter:", lines.length - 1);
  console.log("Listings after filter:", listings.length);
  console.log("Sample listing:", listings[0]);

  // Don't cache if no valid listings found
  if (listings.length === 0) {
    console.error("No listings found after filtering. Headers:", headers);
    throw new Error("No valid listings found");
  }

  // Cache the result
  try {
    localStorage.setItem(
      LISTING_CACHE_KEY,
      JSON.stringify({ data: listings, timestamp: Date.now() })
    );
  } catch (error) {
    console.warn("Cache write error for listing status:", error);
  }

  return listings;
};
