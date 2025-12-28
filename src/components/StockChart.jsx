import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchDailyTimeSeries } from '../services/alphaVantageApi';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StockChart = ({ symbol = 'AAPL', days = 30 }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);
        const timeSeries = await fetchDailyTimeSeries(symbol, days);

        const labels = timeSeries.map(data => {
          const date = new Date(data.date);
          return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        });

        const prices = timeSeries.map(data => data.close);

        setChartData({
          labels,
          datasets: [
            {
              label: `${symbol} Closing Price`,
              data: prices,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 2,
              pointHoverRadius: 6,
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
  }, [symbol, days]);

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
      <h2 className="text-2xl font-bold text-white mb-4">
        {symbol} - Last {days} Days
      </h2>
      <div className="h-96">
        {chartData && <Line data={chartData} options={options} />}
      </div>
    </div>
  );
};

export default StockChart;
