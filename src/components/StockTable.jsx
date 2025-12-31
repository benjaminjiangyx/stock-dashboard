const StockTable = ({ stocks, loading }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!stocks || stocks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No stock data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="grid grid-cols-3 w-full bg-zinc-800 border-b-2 border-zinc-700">
        <div className="px-6 py-4 text-xl text-center font-medium text-gray-300 uppercase tracking-wider">
          Stock Symbol
        </div>
        <div className="px-6 py-4 text-xl text-center font-medium text-gray-300 uppercase tracking-wider">
          Price
        </div>
        <div className="px-6 py-4 text-xl text-center font-medium text-gray-300 uppercase tracking-wider">
          % Change
        </div>
      </div>

      {/* Body */}
      <div className="w-full bg-zinc-900 divide-y divide-zinc-800">
        {stocks.map((stock) => {
          const isPositive = stock.change >= 0;
          return (
            <div
              key={stock.symbol}
              className="grid grid-cols-3 w-full hover:bg-zinc-800/70 transition-colors"
            >
              <div className="px-6 py-4 text-xl text-center font-bold text-white">
                {stock.symbol}
              </div>
              <div className="px-6 py-4 text-xl text-center text-gray-300">
                ${stock.price?.toFixed(2) || "N/A"}
              </div>
              <div
                className={`px-6 py-4 text-xl text-center font-semibold ${
                  isPositive ? "text-emerald-400" : "text-orange-500"
                }`}
              >
                {isPositive ? "+" : ""}
                {stock.change?.toFixed(2)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StockTable;
