import { useState, useRef, useEffect, useCallback } from "react";
import { popularStocks, loadPopularStocks } from "../data/popularStocks";
import { fetchQuote, fetchDailyTimeSeries } from "../services/alphaVantageApi";

const StockManager = ({
  symbols,
  onSymbolsChange,
  selectedSymbol,
  onSymbolSelect,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [allStocks, setAllStocks] = useState(popularStocks);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const hasLoadedListings = useRef(false);
  const listingsLoading = useRef(false);

  const ensureListingsLoaded = useCallback(() => {
    if (hasLoadedListings.current || listingsLoading.current) {
      return;
    }

    listingsLoading.current = true;
    loadPopularStocks()
      .then((stocks) => {
        hasLoadedListings.current = true;
        setAllStocks(stocks);
      })
      .catch((error) => {
        console.warn("Failed to load full listings:", error);
      })
      .finally(() => {
        listingsLoading.current = false;
      });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const validateSymbol = (symbol) => {
    // Basic validation: 1-5 uppercase letters (allowing dots for some symbols like BRK.B)
    const symbolRegex = /^[A-Z.]{1,6}$/;
    return symbolRegex.test(symbol);
  };

  const updateSuggestions = (value) => {
    const upperValue = value.toUpperCase();
    if (!hasLoadedListings.current && upperValue.length > 0) {
      ensureListingsLoaded();
    }
    if (!upperValue) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const filtered = allStocks.filter((stock) =>
      stock.symbol.startsWith(upperValue)
    );

    setSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
    setSelectedIndex(-1);
  };

  const handleAdd = async (symbolToAdd) => {
    const symbol = (symbolToAdd || inputValue).trim().toUpperCase();

    if (!symbol) {
      setError("Please enter a stock symbol");
      return;
    }

    if (!validateSymbol(symbol)) {
      setError("Invalid symbol format");
      return;
    }

    if (symbols.includes(symbol)) {
      setError("Symbol already in watchlist");
      return;
    }

    // Validate symbol with API before adding and pre-fetch chart data
    try {
      setError("Loading data...");

      // Fetch quote to validate symbol (required)
      await fetchQuote(symbol, false);

      // Small delay to avoid hitting rate limits (5 requests per minute)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to fetch chart data, but don't fail if it errors due to API limits
      try {
        await fetchDailyTimeSeries(symbol, false);
      } catch (chartErr) {
        console.warn(
          `Could not pre-fetch chart data for ${symbol}:`,
          chartErr.message
        );
        // Continue anyway - chart will load from cache or show error later
      }

      // If quote fetch succeeded, add to watchlist
      const newSymbols = [...symbols, symbol];
      onSymbolsChange(newSymbols);
      onSymbolSelect(symbol); // Automatically switch to the new symbol
      setInputValue("");
      setError("");
      setShowDropdown(false);
    } catch (err) {
      setError(`Invalid symbol: ${err.message}`);
    }
  };

  const handleRemove = (symbolToRemove) => {
    if (symbols.length === 1) {
      setError("Cannot remove the last symbol");
      return;
    }

    const newSymbols = symbols.filter((s) => s !== symbolToRemove);
    onSymbolsChange(newSymbols);
    setError("");

    // If removed symbol was selected, select the first one
    if (selectedSymbol === symbolToRemove) {
      onSymbolSelect(newSymbols[0]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleAdd(suggestions[selectedIndex].symbol);
      } else {
        handleAdd();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value.toUpperCase();
    setInputValue(value);
    setError("");
    updateSuggestions(value);
  };

  const handleSuggestionClick = (symbol) => {
    handleAdd(symbol);
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4 !px-2">
        {" "}
        Manage Watchlist
      </h2>

      <div className="flex gap-3 relative !px-2">
        <div className="flex-1 relative ">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={ensureListingsLoaded}
            onKeyDown={handleKeyDown}
            placeholder="Enter symbol (e.g., TSLA)"
            className="w-full bg-zinc-800 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            maxLength={6}
          />
          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            >
              {suggestions.map((stock, index) => (
                <div
                  key={stock.symbol}
                  onClick={() => handleSuggestionClick(stock.symbol)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? "bg-emerald-600 text-white"
                      : "hover:bg-zinc-700 text-gray-200"
                  }`}
                >
                  <div className="font-semibold">{stock.symbol}</div>
                  <div className="text-xs text-gray-400">{stock.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => handleAdd()} className="btn-primary px-6">
          Add Stock
        </button>
      </div>

      {error && <div className="text-orange-400 text-sm mt-2 mb-4">{error}</div>}

      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
        {symbols.map((symbol) => (
          <div
            key={symbol}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedSymbol === symbol
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
            }`}
          >
            <button
              onClick={() => onSymbolSelect(symbol)}
              className="font-medium"
            >
              {symbol}
            </button>
            <button
              onClick={() => handleRemove(symbol)}
              className="text-orange-400 hover:text-orange-300 ml-2"
              title="Remove from watchlist"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="text-sm text-gray-400" style={{ marginTop: "0.25rem" }}>
        Click a symbol to view its chart • Click × to remove from watchlist
      </div>
    </div>
  );
};

export default StockManager;
