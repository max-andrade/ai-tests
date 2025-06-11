
import React from 'react';
import { AppView } from '../types'; // Updated AppView type will be used

interface AppHeaderProps {
  currentView: AppView;
  onSetCurrentView: (view: AppView) => void;
  isAzureOperationLoading: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  currentView,
  onSetCurrentView,
  isAzureOperationLoading
}) => {
  return (
    <header className="mb-6 pb-4 border-b border-gray-700">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center">
        <div className="text-center sm:text-left mb-4 sm:mb-0">
          <h1 className="text-4xl sm:text-5xl font-bold text-primary-400">Investment Tracker</h1>
          <p className="text-gray-400 mt-1">Manage your crypto and equity portfolios.</p>
        </div>
        <div className="flex flex-wrap justify-center sm:justify-end items-center gap-2">
          <button
            onClick={() => onSetCurrentView(currentView === 'investments' ? 'settings' : 'investments')} // Req 6
            disabled={isAzureOperationLoading}
            className="px-3 py-2 text-xs sm:text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-lg shadow-md disabled:opacity-50"
          >
            {currentView === 'investments' ? 'Settings' : 'Investments View'} {/* Req 6 */}
          </button>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
