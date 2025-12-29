import { useState } from "react";

const StockManager = ({
  symbols,
  onSymbolsChange,
  selectedSymbol,
  onSymbolSelect,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  const validateSymbol = (symbol) => {
    // Basic validation: 1-5 uppercase letters
    const symbolRegex = /^[A-Z]{1,5}$/;
    return symbolRegex.test(symbol);
  };

  const handleAdd = () => {
    const symbol = inputValue.trim().toUpperCase();

    if (!symbol) {
      setError("Please enter a stock symbol");
      return;
    }

    if (!validateSymbol(symbol)) {
      setError("Invalid symbol format (1-5 uppercase letters)");
      return;
    }

    if (symbols.includes(symbol)) {
      setError("Symbol already in watchlist");
      return;
    }

    const newSymbols = [...symbols, symbol];
    onSymbolsChange(newSymbols);
    setInputValue("");
    setError("");
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
      handleAdd();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-xl font-bold text-white mb-4"> Manage Watchlist</h2>

      <div className="flex gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value.toUpperCase());
            setError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder="Enter symbol (e.g., TSLA)"
          className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          maxLength={5}
        />
        <button onClick={handleAdd} className="btn-primary px-6">
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
