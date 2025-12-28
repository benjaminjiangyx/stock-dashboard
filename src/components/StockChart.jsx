import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { fetchDailyTimeSeries } from '../services/alphaVantageApi';

const StockChart = ({ symbol = 'AAPL', days = 30 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const isInitializedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    // Check if chart already exists and clean it up FIRST
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Clear any leftover DOM elements
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    // Prevent double initialization
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    let chart = null;
    let resizeHandler = null;

    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const timeSeries = await fetchDailyTimeSeries(symbol, days);

        // Create chart
        const containerWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800;

        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: '#1f2937' },
            textColor: '#9ca3af',
          },
          grid: {
            vertLines: { color: 'rgba(75, 85, 99, 0.3)' },
            horzLines: { color: 'rgba(75, 85, 99, 0.3)' },
          },
          width: containerWidth,
          height: 384, // h-96 = 384px
          timeScale: {
            timeVisible: true,
            secondsVisible: false,
          },
        });

        chartRef.current = chart;

        // Add candlestick series (v5 API)
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: 'rgb(34, 197, 94)',
          downColor: 'rgb(239, 68, 68)',
          borderUpColor: 'rgb(34, 197, 94)',
          borderDownColor: 'rgb(239, 68, 68)',
          wickUpColor: 'rgb(34, 197, 94)',
          wickDownColor: 'rgb(239, 68, 68)',
        });

        // Convert data to lightweight-charts format
        const candleData = timeSeries.map(data => ({
          time: data.date, // lightweight-charts expects 'YYYY-MM-DD' format
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        }));

        candlestickSeries.setData(candleData);

        // Fit content
        chart.timeScale().fitContent();

        setLoading(false);

        // Handle resize with debouncing for better performance
        let resizeTimeout;
        resizeHandler = () => {
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            if (chartContainerRef.current && chart) {
              const newWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800;
              chart.applyOptions({
                width: newWidth,
              });
              chart.timeScale().fitContent();
            }
          }, 100);
        };

        window.addEventListener('resize', resizeHandler);

        // Use ResizeObserver for more responsive resizing
        const resizeObserver = new ResizeObserver((entries) => {
          if (chart && entries[0]) {
            const newWidth = entries[0].contentRect.width || 800;
            chart.applyOptions({
              width: newWidth,
            });
          }
        });

        if (chartContainerRef.current) {
          resizeObserver.observe(chartContainerRef.current);
        }

        // Store resizeObserver for cleanup
        chart.resizeObserver = resizeObserver;

        // Trigger an immediate resize to ensure proper sizing
        setTimeout(() => {
          if (chartContainerRef.current && chart) {
            const newWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || 800;
            chart.applyOptions({
              width: newWidth,
            });
          }
        }, 100);
      } catch (err) {
        console.error('Chart loading error:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadChartData();

    // Cleanup function
    return () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (chart) {
        if (chart.resizeObserver) {
          chart.resizeObserver.disconnect();
        }
        chart.remove();
      }
      if (chartRef.current) {
        if (chartRef.current.resizeObserver) {
          chartRef.current.resizeObserver.disconnect();
        }
        chartRef.current.remove();
        chartRef.current = null;
      }
      // Reset after cleanup
      setTimeout(() => {
        isInitializedRef.current = false;
      }, 0);
    };
  }, [symbol, days]);

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        {symbol} - Last {days} Days
      </h2>
      {loading && (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}
      {error && (
        <div className="text-center py-12 text-red-400 h-96">
          Error loading chart: {error}
        </div>
      )}
      <div ref={chartContainerRef} className="h-96" style={{ display: loading || error ? 'none' : 'block' }} />
    </div>
  );
};

export default StockChart;
