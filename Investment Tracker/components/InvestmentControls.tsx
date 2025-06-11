
import React from 'react';
import { AutoRefreshConfig, FinancialYear } from '../types'; 

interface InvestmentControlsProps {
  autoRefreshConfig: AutoRefreshConfig;
  onToggleAutoRefresh: () => void;
  onManualRefresh: () => void;
  showTerminatedInvestments: boolean;
  onToggleShowTerminated: () => void;
  selectedFinancialYear: FinancialYear;
  financialYearOptions: { value: FinancialYear; label: string }[];
  onSetSelectedFinancialYear: (fy: FinancialYear) => void;
  onOpenFormForNew: () => void;
  onExportToCSV: () => void; // Req 2: Added prop
}

const InvestmentControls: React.FC<InvestmentControlsProps> = ({
  autoRefreshConfig,
  onToggleAutoRefresh,
  onManualRefresh,
  showTerminatedInvestments,
  onToggleShowTerminated,
  selectedFinancialYear,
  financialYearOptions,
  onSetSelectedFinancialYear,
  onOpenFormForNew,
  onExportToCSV, // Req 2: Destructure prop
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="autoRefresh"
            checked={autoRefreshConfig.enabled}
            onChange={onToggleAutoRefresh}
            className="h-4 w-4 text-primary-600 border-gray-500 rounded bg-gray-700 focus:ring-primary-500 focus:ring-offset-gray-800"
          />
          <label htmlFor="autoRefresh" className="text-sm text-gray-300">Auto-Refresh Prices</label>
        </div>
        {!autoRefreshConfig.enabled && (
          <button 
            onClick={onManualRefresh} 
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm"
            aria-label="Refresh prices now"
          >
            Refresh Now
          </button>
        )}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="showTerminated"
            checked={showTerminatedInvestments}
            onChange={onToggleShowTerminated}
            className="h-4 w-4 text-primary-600 border-gray-500 rounded bg-gray-700 focus:ring-primary-500 focus:ring-offset-gray-800"
            disabled={selectedFinancialYear !== "ALL_TIME"} 
          />
          <label htmlFor="showTerminated" className={`text-sm text-gray-300 ${selectedFinancialYear !== "ALL_TIME" ? 'opacity-50' : ''}`}>Show Terminated</label>
        </div>
        <div>
          <select
            id="financialYearSelect"
            value={selectedFinancialYear}
            onChange={(e) => onSetSelectedFinancialYear(e.target.value as FinancialYear)}
            className="bg-gray-700 text-gray-200 border-gray-600 rounded-md py-1.5 px-3 text-sm focus:ring-primary-500 focus:border-primary-500 shadow-sm"
            aria-label="Select financial year for report"
          >
            {financialYearOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
         {/* Req 2: Export CSV Button */}
        <button
            onClick={onExportToCSV}
            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md shadow-sm"
            aria-label="Export investments to CSV file"
        >
            Export CSV
        </button>
      </div>

      <button 
        onClick={onOpenFormForNew} 
        className="px-6 py-3 text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-md font-semibold flex items-center space-x-2 w-full sm:w-auto justify-center"
        aria-label="Add new investment"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        <span>Add Investment</span>
      </button>
    </div>
  );
};

export default InvestmentControls;
