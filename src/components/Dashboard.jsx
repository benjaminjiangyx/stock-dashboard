import { useState } from 'react';
import { useStockData } from '../hooks/useStockData';
import StockTable from './StockTable';
import StockChart from './StockChart';

const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'V', 'JNJ'];

const Dashboard = () => {
  const { stocks, loading, error, refetch } = useStockData(STOCK_SYMBOLS);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col">
      <div className="px-8 py-4">
        <h1 className="text-6xl font-bold text-white text-center mb-8">
          Stock Price Dashboard
        </h1>

        <div className="flex justify-between items-center bg-gray-800 p-4 rounded-lg mb-6 max-w-7xl mx-auto w-full">
          <div className="text-lg text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn-primary"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-center max-w-7xl mx-auto w-full mb-6">
            Error: {error}
          </div>
        )}
      </div>

      <div className="w-full flex-1 flex flex-col gap-6 px-8 pb-8">
        <StockChart symbol="AAPL" />
        <StockTable stocks={stocks} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
