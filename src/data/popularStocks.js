import { fetchListingStatus } from '../services/alphaVantageApi';

// Default popular stocks as fallback
const defaultPopularStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc. Class B' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'MA', name: 'Mastercard Incorporated' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'PG', name: 'Procter & Gamble Company' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
  { symbol: 'HD', name: 'Home Depot Inc.' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
];

// Store for dynamically loaded stocks
let cachedStocks = null;
let loadingPromise = null;

// Load stocks from API
export const loadPopularStocks = async () => {
  if (cachedStocks) {
    return cachedStocks;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = fetchListingStatus()
    .then((stocks) => {
      cachedStocks = stocks;
      return stocks;
    })
    .catch((error) => {
      console.warn('Failed to load listing status, using default stocks:', error);
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
