import { useState, useRef, useEffect } from "react";
import { popularStocks, loadPopularStocks, getPopularStocks } from "../data/popularStocks";
import { fetchQuote } from "../services/alphaVantageApi";

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

  // Load full listing on mount
  useEffect(() => {
    loadPopularStocks().then((stocks) => {
      setAllStocks(stocks);
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
    if (!upperValue) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const filtered = allStocks
      .filter((stock) => stock.symbol.startsWith(upperValue));

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

    // Validate symbol with API before adding
    try {
      setError("Validating symbol...");
      await fetchQuote(symbol, false); // Don't use cache for validation

      // If API call succeeds, add to watchlist
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
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4"> Manage Watchlist</h2>

      <div className="flex gap-3 relative">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter symbol (e.g., TSLA)"
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={6}
          />
          {showDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto"
            >
              {suggestions.map((stock, index) => (
                <div
                  key={stock.symbol}
                  onClick={() => handleSuggestionClick(stock.symbol)}
                  className={`px-4 py-2 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-600 text-gray-200"
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

      {error && <div className="text-red-400 text-sm mt-2 mb-4">{error}</div>}

      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
        {symbols.map((symbol) => (
          <div
            key={symbol}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              selectedSymbol === symbol
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
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
              className="text-red-400 hover:text-red-300 ml-2"
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
