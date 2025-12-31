import { Settings } from "lucide-react";

const Header = ({ onSettingsClick }) => {
  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-900 border-b border-zinc-800">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        {/* App Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">$</span>
          </div>
          <h1 className="text-xl font-bold text-white">Stock Dashboard</h1>
        </div>

        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="p-2 text-gray-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors ml-auto"
          aria-label="Settings"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>
    </header>
  );
};

export default Header;
