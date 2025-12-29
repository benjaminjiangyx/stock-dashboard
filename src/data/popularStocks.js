import { fetchListingStatus } from "../services/alphaVantageApi";

// Default popular stocks as fallback
const defaultPopularStocks = [
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A" },
  { symbol: "GOOG", name: "Alphabet Inc. Class C" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. Class B" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "MA", name: "Mastercard Incorporated" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "PG", name: "Procter & Gamble Company" },
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "UNH", name: "UnitedHealth Group Incorporated" },
  { symbol: "HD", name: "Home Depot Inc." },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
];

// Store for dynamically loaded stocks
let cachedStocks = null;
let loadingPromise = null;

const STORAGE_KEY = "stock_listing_cache";
const CACHE_EXPIRY_KEY = "stock_listing_cache_expiry";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Load from localStorage cache
const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);

    if (cached && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        const stocks = JSON.parse(cached);
        console.log(`Loaded ${stocks.length} stocks from cache`);
        return stocks;
      } else {
        console.log("Cache expired, will fetch fresh data");
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CACHE_EXPIRY_KEY);
      }
    }
  } catch (error) {
    console.warn("Error loading from cache:", error);
  }
  return null;
};

// Save to localStorage cache
const saveToCache = (stocks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
    localStorage.setItem(
      CACHE_EXPIRY_KEY,
      (Date.now() + CACHE_DURATION).toString()
    );
    console.log(`Cached ${stocks.length} stocks (expires in 7 days)`);
  } catch (error) {
    console.warn("Error saving to cache:", error);
  }
};

// Load stocks from API
export const loadPopularStocks = async () => {
  if (cachedStocks) {
    console.log("Using cached stocks");
    return cachedStocks;
  }

  // Try to load from localStorage first
  const cachedFromStorage = loadFromCache();
  if (cachedFromStorage) {
    cachedStocks = cachedFromStorage;
    return cachedStocks;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  console.log("Fetching stock listing from Alpha Vantage API...");
  loadingPromise = fetchListingStatus()
    .then((stocks) => {
      cachedStocks = stocks;
      saveToCache(stocks);
      console.log(
        `Successfully fetched and cached ${stocks.length} stocks from API`
      );
      return stocks;
    })
    .catch((error) => {
      console.warn(
        "Failed to load listing status, using default stocks:",
        error
      );
      cachedStocks = defaultPopularStocks;
      return defaultPopularStocks;
    })
    .finally(() => {
      loadingPromise = null;
    });

  return loadingPromise;
};

// Export default stocks for immediate use
export const popularStocks = defaultPopularStocks;

// Export function to get current stocks (will be updated after API loads)
export const getPopularStocks = () => cachedStocks || defaultPopularStocks;
