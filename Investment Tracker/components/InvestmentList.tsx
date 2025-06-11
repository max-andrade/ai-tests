
import React, { useMemo } from 'react';
import { Investment, ManagedAsset, AssetGroupSortConfig, AssetGroupSortKey, SortDirection, FinancialYear, ALL_TIME_FY, InvestmentType } from '../types';
import InvestmentItem from './InvestmentItem';

interface InvestmentListProps {
  investments: Investment[]; 
  managedAssets: ManagedAsset[]; 
  currentlyFetchingAssetApiIds: Set<string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onWithdraw: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatPercentage: (value: number) => string;
  formatDateTime: (isoString?: string | null) => string;
  collapsedAssetGroups: Record<string, boolean>;
  onToggleAssetGroupCollapse: (assetId: string) => void;
  assetGroupSortConfig: AssetGroupSortConfig;
  onChangeSortConfig: (key: AssetGroupSortKey, direction: SortDirection) => void;
  selectedFinancialYear: FinancialYear; 
  onAddNewInvestmentForAsset: (assetId: string) => void;
  onToggleFlagInvestment: (id: string) => void; // Req 1
  individualInvestmentCollapseStates: Record<string, boolean>; // Req 3
  onToggleInvestmentCollapse: (id: string) => void; // Req 3
}

const InvestmentList: React.FC<InvestmentListProps> = ({
  investments,
  managedAssets,
  currentlyFetchingAssetApiIds,
  onEdit,
  onDelete,
  onWithdraw,
  formatCurrency,
  formatPercentage,
  formatDateTime,
  collapsedAssetGroups,
  onToggleAssetGroupCollapse,
  assetGroupSortConfig,
  onChangeSortConfig,
  selectedFinancialYear,
  onAddNewInvestmentForAsset,
  onToggleFlagInvestment, // Req 1
  individualInvestmentCollapseStates, // Req 3
  onToggleInvestmentCollapse, // Req 3
}) => {
  const investmentsByAssetId = useMemo(() => {
    return investments.reduce((acc, inv) => {
      const assetKey = inv.assetId;
      if (!acc[assetKey]) acc[assetKey] = [];
      acc[assetKey].push(inv);
      return acc;
    }, {} as Record<string, Investment[]>);
  }, [investments]);

  const assetsToDisplay = managedAssets.filter(ma => investmentsByAssetId[ma.id] && investmentsByAssetId[ma.id].length > 0);

  const selectedFYTotalPandL = useMemo(() => {
    if (selectedFinancialYear === ALL_TIME_FY || !investments) {
      return null;
    }
    return investments.reduce((sum, inv) => {
      if (!inv.endDate) return sum; 
      const originalValue = inv.units * inv.priceOnInvestmentAUD;
      const terminatedValue = inv.units * inv.currentPricePerUnitAUD; 
      return sum + (terminatedValue - originalValue);
    }, 0);
  }, [investments, selectedFinancialYear]);


  if (assetsToDisplay.length === 0) {
    return <p className="text-center text-gray-400 mt-8 text-lg">No investments to display based on current filters. Try adjusting filters or adding new investments.</p>;
  }

  const sortOptions: { value: AssetGroupSortKey; label: string }[] = [
    { value: 'assetName', label: 'Asset Name' },
    { value: 'latestInvestmentDate', label: 'Latest Investment in Group' },
    { value: 'oldestInvestmentDate', label: 'Oldest Investment in Group' },
    { value: 'totalInvestedValue', label: 'Total Invested (Active in Group)' },
  ];
  
  const formatUnitsForGroupHeader = (units: number, type: InvestmentType) => {
    if (type === InvestmentType.CRYPTO) {
        return units.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
    }
    return units.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2});
  }


  return (
    <div>
      {selectedFinancialYear !== ALL_TIME_FY && selectedFYTotalPandL !== null && (
        <div className="mb-4 p-3 bg-gray-700 rounded-md shadow text-center">
          <h4 className="text-md sm:text-lg font-semibold text-primary-300">
            Realised P/L for {selectedFinancialYear.replace('-', ' - ')}: {formatCurrency(selectedFYTotalPandL)}
          </h4>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-gray-800 rounded-md shadow">
        <label htmlFor="sort-key-select" className="text-sm font-medium text-gray-300">Sort groups by:</label>
        <select
          id="sort-key-select"
          value={assetGroupSortConfig.key}
          onChange={(e) => onChangeSortConfig(e.target.value as AssetGroupSortKey, assetGroupSortConfig.direction)}
          className="bg-gray-700 text-gray-200 border-gray-600 rounded-md py-1.5 px-3 text-sm focus:ring-primary-500 focus:border-primary-500 shadow-sm"
        >
          {sortOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={() => onChangeSortConfig(assetGroupSortConfig.key, assetGroupSortConfig.direction === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md text-gray-200 shadow-sm flex items-center"
          aria-label={`Sort direction: ${assetGroupSortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}`}
        >
          {assetGroupSortConfig.direction === 'asc' ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          )}
          {assetGroupSortConfig.direction === 'asc' ? 'Asc' : 'Desc'}
        </button>
      </div>

      <div className="space-y-8">
        {assetsToDisplay.map(asset => {
          const groupInvestments = investmentsByAssetId[asset.id];
          if (!groupInvestments || groupInvestments.length === 0) return null;

          const activeGroupInvestments = groupInvestments.filter(inv => !inv.endDate);

          const groupTotalOriginalActive = activeGroupInvestments.reduce((sum, inv) => sum + inv.units * inv.priceOnInvestmentAUD, 0);
          const groupTotalCurrentActive = activeGroupInvestments.reduce((sum, inv) => sum + inv.units * inv.currentPricePerUnitAUD, 0);
          const groupTotalUnitsActive = activeGroupInvestments.reduce((sum, inv) => sum + inv.units, 0); 
          const groupPLActive = groupTotalCurrentActive - groupTotalOriginalActive;
          const groupPLPercentageActive = groupTotalOriginalActive > 0 ? (groupPLActive / groupTotalOriginalActive) * 100 : 0;

          const groupPLColor = groupPLActive >= 0 ? 'text-green-400' : 'text-red-400';
          const groupPLSign = groupPLActive >= 0 ? '+' : '';

          const sortedGroupInvestments = [...groupInvestments].sort((a, b) => {
            if (!a.endDate && b.endDate) return -1;
            if (a.endDate && !b.endDate) return 1;
            return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
          });

          const isAssetGroupCollapsed = collapsedAssetGroups[asset.id] ?? true;

          const handleHeaderClick = (e: React.MouseEvent<HTMLDivElement>) => {
            if ((e.target as HTMLElement).closest('.add-investment-for-asset-btn')) {
              return;
            }
            onToggleAssetGroupCollapse(asset.id);
          };
           const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            if ((e.target as HTMLElement).closest('.add-investment-for-asset-btn')) {
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
                onToggleAssetGroupCollapse(asset.id);
            }
          };


          return (
            <div key={asset.id} className="bg-gray-800/70 rounded-lg shadow-md">
              <div
                className="flex flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center p-3 sm:p-4 border-b border-gray-700 gap-x-2 gap-y-2 cursor-pointer hover:bg-gray-700/50 transition-colors"
                onClick={handleHeaderClick}
                role="button"
                aria-expanded={!isAssetGroupCollapsed}
                aria-controls={`asset-group-${asset.id}`}
                tabIndex={0}
                onKeyDown={handleHeaderKeyDown}
              >
                <div className="flex items-center mr-auto">
                    {isAssetGroupCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-400 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-400 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    )}
                    <h3 className="text-lg md:text-xl font-semibold text-primary-300 whitespace-nowrap">
                        {asset.userGivenName} <span className="text-sm text-gray-400">({asset.apiId})</span>
                    </h3>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddNewInvestmentForAsset(asset.id); }}
                        className="add-investment-for-asset-btn ml-2 p-1 text-primary-400 hover:text-primary-200 bg-gray-700 hover:bg-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                        aria-label={`Add new investment for ${asset.userGivenName}`}
                        title={`Add new investment for ${asset.userGivenName}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    </button>
                </div>
                <div className="flex flex-wrap items-baseline space-x-2 sm:space-x-4 text-xs sm:text-sm w-full sm:w-auto justify-start sm:justify-end mt-2 sm:mt-0 pl-7 sm:pl-0">
                  {/* Req 7: Removed "(Active)" from labels */}
                  {selectedFinancialYear === ALL_TIME_FY && ( 
                    <>
                      <span className="whitespace-nowrap flex flex-col sm:flex-row sm:items-baseline"><span className="text-gray-400 mr-1">Units:</span><span className="font-semibold text-gray-200">{formatUnitsForGroupHeader(groupTotalUnitsActive, asset.type)}</span></span>
                      <span className="whitespace-nowrap flex flex-col sm:flex-row sm:items-baseline"><span className="text-gray-400 mr-1">Invested:</span><span className="font-semibold text-gray-200">{formatCurrency(groupTotalOriginalActive)}</span></span>
                      <span className="whitespace-nowrap flex flex-col sm:flex-row sm:items-baseline"><span className="text-gray-400 mr-1">Value:</span><span className="font-semibold text-gray-200">{formatCurrency(groupTotalCurrentActive)}</span></span>
                      <span className={`whitespace-nowrap flex flex-col sm:flex-row sm:items-baseline`}><span className="text-gray-400 mr-1">P/L:</span><span className={`font-semibold ${groupPLColor}`}>{groupPLSign}{formatCurrency(groupPLActive)} ({groupPLSign}{formatPercentage(groupPLPercentageActive)})</span></span>
                    </>
                  )}
                  {selectedFinancialYear !== ALL_TIME_FY && groupInvestments.length > 0 && ( 
                     <span className="whitespace-nowrap flex flex-col sm:flex-row sm:items-baseline"><span className="text-gray-400 mr-1">Terminated Count:</span><span className="font-semibold text-gray-200">{groupInvestments.length}</span></span>
                  )}
                </div>
              </div>

              {!isAssetGroupCollapsed && (
                <div id={`asset-group-${asset.id}`} className="space-y-0 p-1 sm:p-2">
                  {sortedGroupInvestments.map(investment => (
                    <div key={investment.id} className="border-t border-gray-700/50 first:border-t-0">
                        <InvestmentItem
                            investment={investment}
                            managedAssets={managedAssets}
                            currentlyFetchingAssetApiIds={currentlyFetchingAssetApiIds}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onWithdraw={onWithdraw}
                            formatDateTime={formatDateTime}
                            formatPercentage={formatPercentage}
                            formatCurrency={formatCurrency}
                            onToggleFlag={onToggleFlagInvestment} // Req 1
                            isCollapsed={individualInvestmentCollapseStates[investment.id] ?? false} // Req 3
                            onToggleCollapse={onToggleInvestmentCollapse} // Req 3
                        />
                    </div>
                  ))}
                   {sortedGroupInvestments.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">No investments for this asset match the current filters.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InvestmentList;
