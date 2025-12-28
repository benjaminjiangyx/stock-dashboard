import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { fetchQuote } from '../services/finnhubApi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const StockChart = ({ symbol = 'AAPL' }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tradingDate, setTradingDate] = useState(null);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);
        const quote = await fetchQuote(symbol);

        // Get trading date
        const tradingDay = new Date(quote.t * 1000);
        setTradingDate(tradingDay.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }));

        // Create a simple bar chart with available data points
        setChartData({
          labels: ['Previous Close', 'Open', 'Low', 'Current', 'High'],
          datasets: [
            {
              label: `${symbol} Price ($)`,
              data: [quote.pc, quote.o, quote.l, quote.c, quote.h],
              backgroundColor: [
                'rgba(156, 163, 175, 0.7)',  // gray for prev close
                'rgba(59, 130, 246, 0.7)',   // blue for open
                'rgba(239, 68, 68, 0.7)',    // red for low
                'rgba(59, 130, 246, 0.9)',   // bright blue for current
                'rgba(34, 197, 94, 0.7)',    // green for high
              ],
              borderColor: [
                'rgb(156, 163, 175)',
                'rgb(59, 130, 246)',
                'rgb(239, 68, 68)',
                'rgb(59, 130, 246)',
                'rgb(34, 197, 94)',
              ],
              borderWidth: 2,
            },
          ],
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadChartData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-400">
        Error loading chart: {error}
      </div>
    );
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#f9fafb',
          font: {
            size: 14,
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#f9fafb',
        bodyColor: '#f9fafb',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9ca3af',
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.3)',
        },
        ticks: {
          color: '#9ca3af',
          callback: function (value) {
            return '$' + value.toFixed(2);
          },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  };

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-2">
        {symbol} - Trading Day Summary
      </h2>
      {tradingDate && (
        <p className="text-gray-400 text-sm mb-4">{tradingDate}</p>
      )}
      <div className="h-96">
        {chartData && <Bar data={chartData} options={options} />}
      </div>
    </div>
  );
};

export default StockChart;
