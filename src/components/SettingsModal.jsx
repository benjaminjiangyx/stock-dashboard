import { useState, useEffect } from "react";
import { X, Eye, EyeOff, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { setUserApiKey, getUserApiKey } from "../services/alphaVantageApi";

const SettingsModal = ({ onClose, isFirstTime = false }) => {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Load existing API key on mount
  useEffect(() => {
    const existingKey = getUserApiKey();
    if (existingKey) {
      setApiKey(existingKey);
    }
  }, []);

  const handleSave = () => {
    setError("");
    setSuccess(false);

    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      setError("API key is required");
      return;
    }

    if (trimmedKey.length < 10) {
      setError("API key appears to be too short");
      return;
    }

    try {
      setUserApiKey(trimmedKey);
      setSuccess(true);

      // Reload page after brief delay to show success message and refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to save API key");
    }
  };

  const handleClear = () => {
    setApiKey("");
    try {
      setUserApiKey("");
      setSuccess(false);
      setError("API key cleared");
    } catch (err) {
      setError(err.message || "Failed to clear API key");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={!isFirstTime ? onClose : undefined}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 bg-zinc-900 rounded-lg shadow-2xl border border-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-800">
            <h2 className="text-2xl font-bold text-white">
              {isFirstTime ? "Welcome to Stock Dashboard" : "API Settings"}
            </h2>
            {!isFirstTime && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {isFirstTime && (
              <div className="bg-zinc-800 rounded-lg p-4 mb-4">
                <p className="text-gray-300 text-sm mb-2">
                  To get started, you'll need a free Alpha Vantage API key.
                </p>
                <a
                  href="https://www.alphavantage.co/support/#api-key"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 text-sm font-medium underline"
                >
                  Get your free API key here →
                </a>
              </div>
            )}

            <div>
              <label
                htmlFor="api-key"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Alpha Vantage API Key {isFirstTime && <span className="text-red-400">*</span>}
              </label>
              <div className="relative">
                <input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-2 pr-12 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                >
                  {showKey ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Security Warning */}
            <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
              <p className="text-xs text-gray-400">
                <strong className="text-gray-300">Security Note:</strong> Your
                API key is stored locally in your browser's localStorage. It
                will never be sent to any server except Alpha Vantage's API.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-700 rounded-lg p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-emerald-900/20 border border-emerald-700 rounded-lg p-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <p className="text-sm text-emerald-400">
                  API key saved successfully!
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                Save
              </button>
              {!isFirstTime && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-medium rounded-lg transition-colors border border-zinc-700"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SettingsModal;
