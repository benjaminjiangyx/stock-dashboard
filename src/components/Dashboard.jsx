import { useState, useEffect } from "react";
import { useStockData } from "../hooks/useStockData";
import StockTable from "./StockTable";
import StockChart from "./StockChart";
import StockManager from "./StockManager";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL"];
const STORAGE_KEY = "stock_watchlist";
const SELECTED_SYMBOL_KEY = "selected_stock_symbol";

// Load symbols from localStorage or use defaults
const loadSymbols = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0
        ? parsed
        : DEFAULT_SYMBOLS;
    }
  } catch (error) {
    console.warn("Error loading symbols from localStorage:", error);
  }
  return DEFAULT_SYMBOLS;
};

// Load selected symbol from localStorage or use first symbol
const loadSelectedSymbol = (symbols) => {
  try {
    const saved = localStorage.getItem(SELECTED_SYMBOL_KEY);
    if (saved && symbols.includes(saved)) {
      return saved;
    }
  } catch (error) {
    console.warn("Error loading selected symbol:", error);
  }
  return symbols[0];
};

const Dashboard = () => {
  const [symbols, setSymbols] = useState(loadSymbols);
  const [selectedSymbol, setSelectedSymbol] = useState(() =>
    loadSelectedSymbol(symbols)
  );
  const { stocks, loading, error, progress } = useStockData(symbols);

  // Save symbols to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  // Save selected symbol to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(SELECTED_SYMBOL_KEY, selectedSymbol);
  }, [selectedSymbol]);

  const handleSymbolsChange = (newSymbols) => {
    setSymbols(newSymbols);
  };

  const handleSymbolSelect = (symbol) => {
    setSelectedSymbol(symbol);
  };

  // Calculate progress percentage
  const progressPercent =
    progress.total > 0
      ? Math.round((progress.loaded / progress.total) * 100)
      : 0;

  return (
    <div className="min-h-screen w-full bg-black flex flex-col p-4">
      <div>
        {loading && progress.total > 0 && (
          <div className="max-w-7xl mx-auto w-full mb-6">
            <div className="bg-zinc-900 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>
                  {progress.status === "waiting"
                    ? progress.message
                    : `Loading ${progress.currentSymbol || "..."} (${
                        progress.loaded + 1
                      }/${progress.total})`}
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 max-w-7xl mx-auto w-full mb-6">
            <div className="font-bold mb-2">Error Loading Stock Data</div>
            <div className="mb-3">{error}</div>
            {error.includes("daily API limit") && (
              <div className="text-sm bg-red-800/30 p-3 rounded border border-red-600 mt-3">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your API limit will reset in 24 hours</li>
                  <li>
                    Refresh the page to load cached data (valid for 24 hours)
                  </li>
                  <li>Cached data loads instantly without using API calls</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className="w-full flex-1 flex flex-col gap-6 !px-4"
        style={{ marginTop: "0.5rem" }}
      >
        <StockManager
          symbols={symbols}
          onSymbolsChange={handleSymbolsChange}
          selectedSymbol={selectedSymbol}
          onSymbolSelect={handleSymbolSelect}
        />
        <div className="flex gap-6">
          <div className="w-1/4 min-w-[300px] flex-shrink-0">
            <StockTable stocks={stocks} loading={loading} />
          </div>
          <div className="flex-1 min-w-0">
            <StockChart
              symbol={selectedSymbol}
            />
          </div>
        </div>
        <div className="text-xs text-gray-500 italic text-center mt-2">
          *Disclaimer: Weekly and monthly data is adjusted, which may cause
          abnormally-large discrepancies during stock splits.
        </div>
        <div className="text-xs text-gray-500 text-center mt-6 pt-4 border-t border-zinc-800">
          © {new Date().getFullYear()} Benjamin Jiang. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
