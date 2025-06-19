
import React from 'react';
import { Investment, ManagedAsset, InvestmentType } from '../types';

interface InvestmentItemProps {
  investment: Investment;
  managedAssets: ManagedAsset[];
  currentlyFetchingAssetApiIds: Set<string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onWithdraw: (id: string) => void;
  formatDateTime: (isoString?: string | null) => string;
  formatPercentage: (value: number) => string;
  formatCurrency: (amount: number) => string;
  onToggleFlag: (id: string) => void; // Req 1
  isCollapsed: boolean; // Req 3
  onToggleCollapse: (id: string) => void; // Req 3
}

const InvestmentItem: React.FC<InvestmentItemProps> = ({
    investment,
    managedAssets,
    currentlyFetchingAssetApiIds,
    onEdit,
    onDelete,
    onWithdraw,
    formatDateTime,
    formatPercentage,
    formatCurrency,
    onToggleFlag, // Req 1
    isCollapsed, // Req 3
    onToggleCollapse // Req 3
}) => {
  const originalInvestmentValueAUD = investment.units * investment.priceOnInvestmentAUD;
  const totalCurrentValueAUD = investment.units * investment.currentPricePerUnitAUD;
  const profitOrLoss = totalCurrentValueAUD - originalInvestmentValueAUD;
  const profitLossPercentage = originalInvestmentValueAUD !== 0
    ? (profitOrLoss / originalInvestmentValueAUD) * 100
    : 0;

  const profitLossColor = profitOrLoss >= 0 ? 'text-green-400' : 'text-red-400';
  const profitLossSign = profitOrLoss >= 0 ? '+' : '';
  const profitLossDisplay = `${profitLossSign}${formatCurrency(profitOrLoss)} (${formatPercentage(profitLossPercentage)})`;

  const assetDetails = managedAssets.find(asset => asset.id === investment.assetId);
  const displayName = assetDetails ? `${assetDetails.userGivenName} (${assetDetails.apiId})` : 'Unknown Asset';
  const displayType = assetDetails ? assetDetails.type.charAt(0) + assetDetails.type.slice(1).toLowerCase() : 'N/A';

  const formatUnits = (units: number, type: InvestmentType) => {
      if (type === InvestmentType.CRYPTO) {
          return units.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
      }
      return units.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2});
  }

  const isCurrentlyUpdating = !investment.endDate && assetDetails && currentlyFetchingAssetApiIds.has(assetDetails.apiId);
  const isTerminated = !!investment.endDate;

  // Req 1: Flag styles
  const flaggedBaseClass = "transition-all duration-300 ease-in-out";
  const flaggedHighlightClass = investment.isFlagged ? "bg-yellow-900/30 border-yellow-600" : "bg-gray-800 border-transparent";
  const flaggedBorderColor = investment.isFlagged ? "border-yellow-600" : (isTerminated ? "border-red-700" : "border-primary-600");


  // Req 3: Collapsed View
  if (isCollapsed) {
    return (
      <div className={`shadow-md rounded-md p-2 my-1 flex items-center justify-between cursor-pointer hover:bg-gray-700/60 ${flaggedBaseClass} ${flaggedHighlightClass} border-l-4 ${flaggedBorderColor}`}>
        <div className="flex items-center flex-grow" onClick={() => onToggleCollapse(investment.id)}>
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          <span className={`text-sm font-medium truncate ${isTerminated ? 'text-gray-500 line-through' : 'text-primary-300'}`}>{displayName}</span>
           {investment.isFlagged && (
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-yellow-500 ml-1.5 shrink-0">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
             </svg>
           )}
        </div>
        <div className="flex items-center space-x-3 text-xs sm:text-sm ml-2 shrink-0">
          <span className="whitespace-nowrap"><span className="text-gray-400">Units:</span> <span className="text-gray-200">{formatUnits(investment.units, investment.type)}</span></span>
          <span className="whitespace-nowrap"><span className="text-gray-400">Value:</span> <span className="text-gray-200">{formatCurrency(totalCurrentValueAUD)}</span></span>
          <span className={`whitespace-nowrap font-semibold ${profitLossColor}`}>{profitLossDisplay}</span>
           <button
            onClick={(e) => { e.stopPropagation(); onToggleFlag(investment.id); }}
            aria-label={investment.isFlagged ? "Unflag investment" : "Flag investment"}
            title={investment.isFlagged ? "Unflag investment" : "Flag investment"}
            className={`p-1 rounded-md hover:bg-gray-600 transition-colors ${investment.isFlagged ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-500'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className={`shadow-lg rounded-lg p-3 md:p-4 mb-2 ${flaggedBaseClass} ${flaggedHighlightClass} border-l-4 ${flaggedBorderColor}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center cursor-pointer flex-grow" onClick={() => onToggleCollapse(investment.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
           <h3 className={`text-lg sm:text-xl font-semibold flex items-center flex-wrap ${isTerminated ? 'text-gray-500' : 'text-primary-400'}`}>
            {displayName}
            <span className="text-xs bg-gray-600 text-gray-200 px-1.5 py-0.5 rounded-full ml-2 whitespace-nowrap">
              {displayType}
            </span>
            {isTerminated && <span className="text-xs bg-red-800 text-red-200 px-1.5 py-0.5 rounded-full ml-2 whitespace-nowrap">Terminated</span>}
          </h3>
        </div>
        {/* Req 1: Flag button */}
        <button
            onClick={() => onToggleFlag(investment.id)}
            aria-label={investment.isFlagged ? "Unflag investment" : "Flag investment"}
            title={investment.isFlagged ? "Unflag investment" : "Flag investment"}
            className={`p-1.5 rounded-md hover:bg-gray-700 transition-colors ${investment.isFlagged ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-500'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
               <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
            </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        {/* Left Column: Details */}
        <div className="md:col-span-2 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="font-medium text-gray-400 text-xs">Units/Shares:</span>
              <p className="text-gray-200">{formatUnits(investment.units, investment.type)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-400 text-xs">Price on Inv. (AUD):</span>
              <p className="text-gray-200">{formatCurrency(investment.priceOnInvestmentAUD)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-400 text-xs">Orig. Inv. Value (AUD):</span>
              <p className="text-gray-200">{formatCurrency(originalInvestmentValueAUD)}</p>
            </div>
            <div className="flex items-center">
              <span className="font-medium text-gray-400 text-xs mr-1">{isTerminated ? 'Price at Termination:' : 'Curr. Price (AUD/unit):'}</span>
              <p className="text-gray-200 flex items-center">
                {formatCurrency(investment.currentPricePerUnitAUD)}
                {isCurrentlyUpdating && (
                  <svg className="animate-spin ml-1.5 h-3.5 w-3.5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {!isTerminated && !isCurrentlyUpdating && <span className="text-xs text-blue-400 ml-1.5">(Live)</span>}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-400 text-xs">{isTerminated ? 'Value at Termination:' : 'Total Curr. Value (AUD):'}</span>
              <p className="text-gray-200">{formatCurrency(totalCurrentValueAUD)}</p>
            </div>
            <div>
              <span className="font-medium text-gray-400 text-xs">P/L:</span>
              <p className={`font-semibold ${profitLossColor}`}>
                {profitLossDisplay}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Dates and Actions */}
        <div className="space-y-1 md:text-right">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-400">Started:</span> {formatDateTime(investment.startDate)}
          </p>
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-400">Ended:</span> {investment.endDate ? formatDateTime(investment.endDate) : <span className="italic text-green-500">Active</span>}
          </p>
          <div className="flex md:justify-end space-x-2 pt-2">
            {!isTerminated && (
              <>
                <button
                  onClick={() => onEdit(investment.id)}
                  aria-label={`Edit ${displayName}`}
                  className="px-3 py-1.5 text-xs font-medium text-primary-300 bg-primary-700 hover:bg-primary-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-500 transition-colors"
                >
                  Edit
                </button>
                 <button
                  onClick={() => onWithdraw(investment.id)}
                  aria-label={`Withdraw from ${displayName}`}
                  className="px-3 py-1.5 text-xs font-medium text-yellow-300 bg-yellow-700 hover:bg-yellow-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-500 transition-colors"
                >
                  Withdraw
                </button>
              </>
            )}
            <button
              onClick={() => onDelete(investment.id)}
              aria-label={`Delete ${displayName}`}
              className="px-3 py-1.5 text-xs font-medium text-red-300 bg-red-700 hover:bg-red-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {/* Req 2: Display Notes */}
      {investment.notes && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <h4 className="text-xs font-semibold text-gray-400 mb-1">Notes:</h4>
          <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-700/50 p-2 rounded-md">{investment.notes}</p>
        </div>
      )}
    </div>
  );
};

export default InvestmentItem;
