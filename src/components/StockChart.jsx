import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import { fetchDailyTimeSeries } from '../services/alphaVantageApi';

const StockChart = ({ symbol = 'AAPL', days = 30 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestData, setLatestData] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let chart = null;
    let resizeHandler = null;

    const cleanup = () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (chart) {
        chart.remove();
        chart = null;
      }
      chartRef.current = null;
    };

    const loadChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const timeSeries = await fetchDailyTimeSeries(symbol, days);

        if (!isMounted || !chartContainerRef.current) {
          return;
        }

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
            rightOffset: 0,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: true,
            minBarSpacing: 0.5,
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

        // Add volume histogram series
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: 'rgba(76, 175, 254, 0.5)',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: 'volume',
        });

        // Configure the volume price scale to take up ~25% at the bottom
        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.75, // Volume starts at 75% from top (bottom 25%)
            bottom: 0,
          },
        });

        // Configure the candlestick price scale to take up ~75% at the top
        candlestickSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.1,
            bottom: 0.3, // Leave 30% for volume
          },
        });

        // Convert data to lightweight-charts format
        const candleData = timeSeries.map(data => ({
          time: data.date, // lightweight-charts expects 'YYYY-MM-DD' format
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        }));

        const volumeData = timeSeries.map(data => ({
          time: data.date,
          value: data.volume,
          color: data.close >= data.open ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        }));

        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);

        // Store the latest (most recent) data for OHLCV display
        const latest = timeSeries[timeSeries.length - 1];
        setLatestData(latest);

        // Fit all data to the visible range
        chart.timeScale().fitContent();

        // Subscribe to crosshair move to update OHLCV on hover
        chart.subscribeCrosshairMove((param) => {
          if (!isMounted) {
            return;
          }

          // If crosshair moved outside the chart or no data, reset to latest
          if (!param.time || !param.seriesData) {
            setLatestData(latest);
            return;
          }

          const data = param.seriesData.get(candlestickSeries);
          if (data) {
            // Find the corresponding time series entry to get volume
            const dateStr = param.time;
            const matchingData = timeSeries.find(d => d.date === dateStr);

            if (matchingData) {
              setLatestData(matchingData);
            }
          } else {
            // No data at this point, reset to latest
            setLatestData(latest);
          }
        });

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
        resizeObserverRef.current = new ResizeObserver((entries) => {
          if (chart && entries[0]) {
            const newWidth = entries[0].contentRect.width || 800;
            chart.applyOptions({
              width: newWidth,
            });
          }
        });

        if (chartContainerRef.current) {
          resizeObserverRef.current.observe(chartContainerRef.current);
        }

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

    // Clear any existing chart before loading new one
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    loadChartData();

    // Cleanup function
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [symbol, days]);

  return (
    <div className="w-full bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">
        {symbol} - Last {days} Days
      </h2>

      {latestData && !loading && !error && (
        <div className="bg-gray-700 rounded-lg p-3 mb-4 grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Open</div>
            <div className="text-white font-semibold">${latestData.open.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">High</div>
            <div className="text-green-400 font-semibold">${latestData.high.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Low</div>
            <div className="text-red-400 font-semibold">${latestData.low.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Close</div>
            <div className="text-white font-semibold">${latestData.close.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-400">Volume</div>
            <div className="text-white font-semibold">{(latestData.volume / 1000000).toFixed(2)}M</div>
          </div>
        </div>
      )}

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
