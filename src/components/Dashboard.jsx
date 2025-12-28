import { useState } from 'react';
import { useStockData } from '../hooks/useStockData';
import StockTable from './StockTable';
import StockChart from './StockChart';

const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL'];

const Dashboard = () => {
  const { stocks, loading, error, progress, refetch } = useStockData(STOCK_SYMBOLS);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const handleRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  // Calculate progress percentage
  const progressPercent = progress.total > 0
    ? Math.round((progress.loaded / progress.total) * 100)
    : 0;

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

        {loading && progress.total > 0 && (
          <div className="max-w-7xl mx-auto w-full mb-6">
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>
                  {progress.status === 'waiting'
                    ? progress.message
                    : `Loading ${progress.currentSymbol || '...'} (${progress.loaded + 1}/${progress.total})`
                  }
                </span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
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
            {error.includes('daily API limit') && (
              <div className="text-sm bg-red-800/30 p-3 rounded border border-red-600 mt-3">
                <p className="font-semibold mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your API limit will reset in 24 hours</li>
                  <li>Refresh the page to load cached data (valid for 5 minutes)</li>
                  <li>Cached data loads instantly without using API calls</li>
                </ul>
              </div>
            )}
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
