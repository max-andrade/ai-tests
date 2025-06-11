
import React from 'react';
import { SummaryStatsData, CachedApiData, SummaryDisplayPropsInternal, CategorizedSummaryStats, InvestmentType } from '../types';

const SummaryDisplay: React.FC<SummaryDisplayPropsInternal> = ({
  summaryStats,
  categorizedSummaryStats,
  cachedApiData,
  formatCurrency,
  formatPercentage,
  formatDateTime,
  formatUnitsForSummary,
}) => {
  const pAndLColor = (value: number) => value >= 0 ? 'text-green-400' : 'text-red-400';
  const pAndLSign = (value: number) => value > 0 ? '+' : (value < 0 ? '' : '');

  const renderCategoryStats = (title: string, data: SummaryStatsData | undefined) => {
    if (!data || !formatUnitsForSummary) return null; // Guard against undefined data or formatter
    return (
      <div className="py-2">
        <h4 className="text-sm font-semibold text-primary-300 mb-1">{title}</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs items-baseline">
          <div>
            <span className="text-gray-400 block sm:inline">Inv. Value:</span>
            <span className="text-gray-200 ml-0 sm:ml-1">{formatCurrency(data.investmentValue)}</span>
          </div>
          <div>
            <span className="text-gray-400 block sm:inline">Port. Value:</span>
            <span className="text-gray-200 ml-0 sm:ml-1">{formatCurrency(data.portfolioValue)}</span>
          </div>
          <div className={`${pAndLColor(data.portfolioPandL)}`}>
            <span className="text-gray-400 block sm:inline">P/L:</span>
            <span className="ml-0 sm:ml-1">{pAndLSign(data.portfolioPandL)}{formatCurrency(data.portfolioPandL)} ({formatPercentage(data.portfolioPandLPercentage)})</span>
          </div>
          <div>
            <span className="text-gray-400 block sm:inline">Active Units:</span>
            <span className="text-gray-200 ml-0 sm:ml-1">{formatUnitsForSummary(data.totalUnits || 0, data.assetType)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center"> 
        <div>
          <p className="text-xs sm:text-sm text-gray-400 uppercase">Investment Value</p>
          <p className="text-xl sm:text-2xl font-semibold text-primary-300">{formatCurrency(summaryStats.investmentValue)}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gray-400 uppercase">Portfolio Value</p>
          <p className="text-xl sm:text-2xl font-semibold text-primary-300">{formatCurrency(summaryStats.portfolioValue)}</p>
        </div>
        <div>
          <p className="text-xs sm:text-sm text-gray-400 uppercase">P/L</p>
          <p className={`text-xl sm:text-2xl font-semibold ${pAndLColor(summaryStats.portfolioPandL)}`}>
            {pAndLSign(summaryStats.portfolioPandL)}{formatCurrency(summaryStats.portfolioPandL)} ({formatPercentage(summaryStats.portfolioPandLPercentage)})
          </p>
        </div>
        <div> 
          <p className="text-xs sm:text-sm text-gray-400 uppercase">Realised P/L (All Time)</p>
          <p className={`text-xl sm:text-2xl font-semibold ${pAndLColor(summaryStats.realisedPandLAllTime)}`}>
            {pAndLSign(summaryStats.realisedPandLAllTime)}{formatCurrency(summaryStats.realisedPandLAllTime)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-700 text-center text-xs text-gray-400">
        <p className="leading-relaxed">
          <span className="font-semibold">Last API Sync:</span>
          <span className="mx-1 sm:mx-2">Crypto: <span className="text-gray-300">{cachedApiData?.syncTimestamps?.crypto ? formatDateTime(cachedApiData.syncTimestamps.crypto) : 'N/A'}</span></span>|
          <span className="mx-1 sm:mx-2">Equities: <span className="text-gray-300">{cachedApiData?.syncTimestamps?.equities ? formatDateTime(cachedApiData.syncTimestamps.equities) : 'N/A'}</span></span>|
          <span className="mx-1 sm:mx-2">USD/AUD <span className="text-gray-300">({cachedApiData?.exchangeRate ? cachedApiData.exchangeRate.toFixed(4) : 'N/A'})</span>: <span className="text-gray-300">{cachedApiData?.syncTimestamps?.exchangeRate ? formatDateTime(cachedApiData.syncTimestamps.exchangeRate) : 'N/A'}</span>
          </span>
        </p>
      </div>

      {categorizedSummaryStats && (
        <div className="mt-3 pt-3 border-t border-gray-700 space-y-1">
          {renderCategoryStats("Bitcoin:", categorizedSummaryStats.bitcoin)}
          {renderCategoryStats("Altcoins (Excl. BTC):", categorizedSummaryStats.altcoins)}
          {renderCategoryStats("Equities:", categorizedSummaryStats.equities)}
        </div>
      )}
    </div>
  );
};

export default SummaryDisplay;
