import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import {
  fetchDailyTimeSeries,
  fetchWeeklyTimeSeries,
  fetchMonthlyTimeSeries,
} from "../services/alphaVantageApi";

const TIME_RANGE_KEY = "chart_time_range";

const StockChart = ({ symbol = "AAPL", refreshTrigger = 0 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [latestData, setLatestData] = useState(null);
  const previousRefreshTrigger = useRef(refreshTrigger);
  const previousSymbol = useRef(symbol);

  // Load time range from localStorage or default to 'daily'
  const [timeRange, setTimeRange] = useState(() => {
    try {
      const saved = localStorage.getItem(TIME_RANGE_KEY);
      return saved === "weekly" || saved === "monthly" ? saved : "daily";
    } catch (error) {
      console.warn("Error loading time range:", error);
      return "daily";
    }
  });

  // Persist time range to localStorage
  useEffect(() => {
    localStorage.setItem(TIME_RANGE_KEY, timeRange);
  }, [timeRange]);

  useEffect(() => {
    let isMounted = true;
    let chart = null;
    let resizeHandler = null;

    const cleanup = () => {
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
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

        // Check if this is a refresh (refreshTrigger changed)
        const isRefresh = refreshTrigger !== previousRefreshTrigger.current;
        previousRefreshTrigger.current = refreshTrigger;
        previousSymbol.current = symbol;

        // Bypass cache on refresh, use cache otherwise (including symbol changes)
        // Symbol changes should use cache because StockManager pre-fetches the data
        const useCache = !isRefresh;

        console.log(
          `[StockChart] Loading chart for ${symbol}, timeRange: ${timeRange}, isRefresh: ${isRefresh}, useCache: ${useCache}`
        );

        // Bypass cache only on refresh, not on symbol change
        // Conditionally fetch daily, weekly, or monthly data based on timeRange
        const timeSeries =
          timeRange === "monthly"
            ? await fetchMonthlyTimeSeries(symbol, useCache)
            : timeRange === "weekly"
            ? await fetchWeeklyTimeSeries(symbol, useCache)
            : await fetchDailyTimeSeries(symbol, useCache);

        console.log(
          `[StockChart] Successfully loaded ${timeRange} chart data for ${symbol}, ${timeSeries.length} data points`
        );

        if (!isMounted) {
          console.log(
            `[StockChart] Component unmounted, skipping chart creation for ${symbol}`
          );
          return;
        }

        if (!chartContainerRef.current) {
          console.error(
            `[StockChart] Chart container ref is null for ${symbol}`
          );
          return;
        }

        // Create chart
        const containerWidth =
          chartContainerRef.current.clientWidth ||
          chartContainerRef.current.offsetWidth ||
          800;
        console.log(
          `[StockChart] Creating chart for ${symbol}, container width: ${containerWidth}`
        );

        chart = createChart(chartContainerRef.current, {
          layout: {
            background: { color: "#18181b" },
            textColor: "#9ca3af",
          },
          grid: {
            vertLines: { color: "rgba(39, 39, 42, 0.5)" },
            horzLines: { color: "rgba(39, 39, 42, 0.5)" },
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
          rightPriceScale: {
            autoScale: true,
            mode: 0, // Normal price scale
            alignLabels: true,
            borderVisible: true,
          },
        });

        chartRef.current = chart;

        // Add candlestick series (v5 API)
        const candlestickSeries = chart.addSeries(CandlestickSeries, {
          upColor: "rgb(0, 200, 5)",
          downColor: "rgb(255, 80, 0)",
          borderUpColor: "rgb(0, 200, 5)",
          borderDownColor: "rgb(255, 80, 0)",
          wickUpColor: "rgb(0, 200, 5)",
          wickDownColor: "rgb(255, 80, 0)",
        });

        // Add volume histogram series
        const volumeSeries = chart.addSeries(HistogramSeries, {
          color: "rgba(0, 200, 5, 0.3)",
          priceFormat: {
            type: "volume",
          },
          priceScaleId: "volume",
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
        const candleData = timeSeries.map((data) => ({
          time: data.date, // lightweight-charts expects 'YYYY-MM-DD' format
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        }));

        const volumeData = timeSeries.map((data) => ({
          time: data.date,
          value: data.volume,
          color:
            data.close >= data.open
              ? "rgba(0, 200, 5, 0.3)"
              : "rgba(255, 80, 0, 0.3)",
        }));

        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);

        // Store the latest (most recent) data for OHLCV display
        const latest = timeSeries[timeSeries.length - 1];
        setLatestData(latest);

        // Fit all data to the visible range
        chart.timeScale().fitContent();

        console.log(`[StockChart] Chart fully rendered for ${symbol}`);

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
            const matchingData = timeSeries.find((d) => d.date === dateStr);

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
              const newWidth =
                chartContainerRef.current.clientWidth ||
                chartContainerRef.current.offsetWidth ||
                800;
              chart.applyOptions({
                width: newWidth,
              });
              chart.timeScale().fitContent();
            }
          }, 100);
        };

        window.addEventListener("resize", resizeHandler);

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
            const newWidth =
              chartContainerRef.current.clientWidth ||
              chartContainerRef.current.offsetWidth ||
              800;
            chart.applyOptions({
              width: newWidth,
            });
          }
        }, 100);
      } catch (err) {
        console.error(`[StockChart] Chart loading error for ${symbol}:`, err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Clear any existing chart before loading new one
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = "";
    }

    loadChartData();

    // Cleanup function
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [symbol, refreshTrigger, timeRange]);

  return (
    <div className="w-full bg-zinc-900 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">{symbol}</h2>

      {/* Time Range Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setTimeRange("daily")}
          className={`!px-3 !py-1 rounded-lg font-medium text-sm transition-all ${
            timeRange === "daily"
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
          }`}
        >
          1D
        </button>
        <button
          onClick={() => setTimeRange("weekly")}
          className={`!px-3 !py-1 rounded-lg font-medium text-sm transition-all ${
            timeRange === "weekly"
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
          }`}
        >
          1W
        </button>
        <button
          onClick={() => setTimeRange("monthly")}
          className={`!px-3 !py-1 rounded-lg font-medium text-sm transition-all ${
            timeRange === "monthly"
              ? "bg-emerald-600 text-white"
              : "bg-zinc-800 text-gray-300 hover:bg-zinc-700"
          }`}
        >
          1M
        </button>
      </div>

      {latestData && !loading && !error && (
        <div className="bg-zinc-800 rounded-lg p-3 mb-4 grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Open</div>
            <div
              className={`font-semibold ${
                latestData.close >= latestData.open
                  ? "text-emerald-400"
                  : "text-orange-500"
              }`}
            >
              ${latestData.open.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">High</div>
            <div
              className={`font-semibold ${
                latestData.close >= latestData.open
                  ? "text-emerald-400"
                  : "text-orange-500"
              }`}
            >
              ${latestData.high.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Low</div>
            <div
              className={`font-semibold ${
                latestData.close >= latestData.open
                  ? "text-emerald-400"
                  : "text-orange-500"
              }`}
            >
              ${latestData.low.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Close</div>
            <div
              className={`font-semibold ${
                latestData.close >= latestData.open
                  ? "text-emerald-400"
                  : "text-orange-500"
              }`}
            >
              ${latestData.close.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-gray-400">Volume</div>
            <div
              className={`font-semibold ${
                latestData.close >= latestData.open
                  ? "text-emerald-400"
                  : "text-orange-500"
              }`}
            >
              {(latestData.volume / 1000000).toFixed(2)}M
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
          <svg
            className="w-16 h-16 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <div className="text-lg font-semibold mb-2">
            Chart Data Unavailable
          </div>
          <div className="text-sm text-gray-500 text-center max-w-md px-4">
            {error.includes("25 requests per day") || error.includes("daily limit")
              ? "Daily API limit reached (25 requests/day). Data will be available from cache or after limit resets."
              : error.includes("per second") || error.includes("API limit")
              ? "Rate limit exceeded. Please wait a moment and try refreshing."
              : "Unable to load chart data at this time"}
          </div>
        </div>
      )}
      <div
        ref={chartContainerRef}
        className="h-96"
        style={{ display: loading || error ? "none" : "block" }}
      />
    </div>
  );
};

export default StockChart;
