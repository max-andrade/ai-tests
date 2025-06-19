import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Investment, InvestmentType, ManagedAsset, AppData, UserPreferences,
    AssetGroupSortConfig, AssetGroupSortKey, SortDirection,
    WithdrawFormData, AutoRefreshConfig, FinancialYear, ALL_TIME_FY, ToastConfig,
    LOCAL_STORAGE_KEYS as APP_LOCAL_STORAGE_KEYS,
    InvestmentFormSubmitData, 
    SummaryStatsData,
    AppView,
    CachedApiData,
    CategorizedSummaryStats // Added import
} from './types';

import AppHeader from './components/AppHeader';
import SummaryDisplay from './components/SummaryDisplay';
import InvestmentControls from './components/InvestmentControls';
import InvestmentList from './components/InvestmentList';
import InvestmentForm from './components/InvestmentForm';
import Modal from './components/Modal';
import SettingsView from './components/SettingsView';
import WithdrawForm from './components/WithdrawForm';
import Toast from './components/Toast';
import AppFooter from './components/AppFooter';

import { fetchConsolidatedPrices } from './services/apiService';
import { uploadDataToAzure, downloadDataFromAzure } from './services/azureBlobStorageService';
import {
    getCurrentDateTimeLocalString,
} from './dateUtils';

export const LOCAL_STORAGE_KEYS = APP_LOCAL_STORAGE_KEYS;

const defaultUserPreferences: UserPreferences = {
  collapsedAssetGroups: {},
  assetGroupSortConfig: { key: 'latestInvestmentDate', direction: 'desc' },
  showTerminatedInvestments: true,
  autoRefreshConfig: { enabled: true },
  selectedFinancialYear: ALL_TIME_FY,
  individualInvestmentCollapseStates: {},
};

const defaultCachedApiData: CachedApiData = {
  cryptoPricesAUD: {},
  equityPricesUSD: {},
  exchangeRate: null,
  syncTimestamps: {},
};

const defaultAppData: AppData = {
  investments: [
    {
      id: "default_btc_investment",
      assetId: 'bitcoin_crypto',
      type: InvestmentType.CRYPTO,
      units: 0.1,
      priceOnInvestmentAUD: 50000,
      currentPricePerUnitAUD: 50000,
      startDate: '2023-01-15T10:00:00.000Z',
      endDate: null,
      isFlagged: false,
      notes: "Initial BTC purchase example."
    },
    {
      id: "default_tsla_investment",
      assetId: 'tsla_equity',
      type: InvestmentType.EQUITY,
      units: 50,
      priceOnInvestmentAUD: 300,
      currentPricePerUnitAUD: 255,
      startDate: '2022-06-01T14:30:00.000Z',
      endDate: '2023-06-01T16:00:00.000Z',
      isFlagged: true,
      notes: "Terminated TSLA stock example."
    },
  ],
  managedAssets: [
    { id: 'bitcoin_crypto', userGivenName: 'Bitcoin', apiId: 'bitcoin', type: InvestmentType.CRYPTO },
    { id: 'ethereum_crypto', userGivenName: 'Ethereum', apiId: 'ethereum', type: InvestmentType.CRYPTO },
    { id: 'solana_crypto', userGivenName: 'Solana', apiId: 'solana', type: InvestmentType.CRYPTO },
    { id: 'tsla_equity', userGivenName: 'Tesla Inc.', apiId: 'TSLA', type: InvestmentType.EQUITY },
    { id: 'aapl_equity', userGivenName: 'Apple Inc.', apiId: 'AAPL', type: InvestmentType.EQUITY },
    { id: 'nvda_equity', userGivenName: 'NVIDIA Corp.', apiId: 'NVDA', type: InvestmentType.EQUITY },
  ],
  preferences: defaultUserPreferences,
  cachedApiData: defaultCachedApiData,
};

export const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPercentage = (value: number): string => {
  if (isNaN(value) || !isFinite(value)) return 'N/A';
  const sign = value > 0 ? '+' : (value < 0 ? '' : ''); 
  return `${sign}${value.toFixed(2)}%`;
};

export const formatDateTime = (utcIsoString?: string | null): string => {
  if (!utcIsoString) return 'N/A';
  const date = new Date(utcIsoString);
  if (isNaN(date.getTime())) {
    console.warn("formatDateTime: Failed to parse UTC date string for display:", utcIsoString);
    return 'Invalid Date';
  }
  try {
    return date.toLocaleString('en-AU', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch (e) {
    console.warn("formatDateTime: Failed to format date with toLocaleString:", utcIsoString, e);
    return 'Formatting Error';
  }
};

const formatUnitsForSummary = (units: number, type?: InvestmentType): string => {
    if (type === InvestmentType.CRYPTO) {
        return units.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 8});
    }
    // Default or Equity
    return units.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2});
};


const generateAssetId = (apiId: string, type: InvestmentType): string => {
  return apiId.toLowerCase().replace(/[^a-z0-9]/gi, '') + '_' + type.toLowerCase();
};

const App: React.FC = () => {
  const [appData, setAppData] = useState<AppData>(defaultAppData);
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true);
  const [isAzureOperationLoading, setIsAzureOperationLoading] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [defaultPreselectedAssetId, setDefaultPreselectedAssetId] = useState<string | undefined>(undefined);
  const [currentView, setCurrentView] = useState<AppView>('investments');
  const [currentlyFetchingAssetApiIds, setCurrentlyFetchingAssetApiIds] = useState<Set<string>>(new Set());
  const importFileRef = useRef<HTMLInputElement>(null);

  const [lastPriceFetchAttemptTimestamp, setLastPriceFetchAttemptTimestamp] = useState<number>(0);
  const [editingManagedAssetId, setEditingManagedAssetId] = useState<string | null>(null);

  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawingInvestment, setWithdrawingInvestment] = useState<Investment | null>(null);
  const [activeToast, setActiveToast] = useState<ToastConfig | null>(null);
  
  const [usdToAudRate, setUsdToAudRate] = useState<number | null>(null);
  const [assetCurrentPricesAUD, setAssetCurrentPricesAUD] = useState<Record<string, number | null>>({});
  const [isFetchingRate, setIsFetchingRate] = useState<boolean>(false);


  const [collapsedAssetGroups, setCollapsedAssetGroups] = useState<Record<string, boolean>>(defaultUserPreferences.collapsedAssetGroups);
  const [assetGroupSortConfig, setAssetGroupSortConfig] = useState<AssetGroupSortConfig>(defaultUserPreferences.assetGroupSortConfig);
  const [showTerminatedInvestments, setShowTerminatedInvestments] = useState<boolean>(defaultUserPreferences.showTerminatedInvestments);
  const [autoRefreshConfig, setAutoRefreshConfig] = useState<AutoRefreshConfig>(defaultUserPreferences.autoRefreshConfig);
  const [selectedFinancialYear, setSelectedFinancialYear] = useState<FinancialYear>(defaultUserPreferences.selectedFinancialYear);
  const [individualInvestmentCollapseStates, setIndividualInvestmentCollapseStates] = useState<Record<string, boolean>>(defaultUserPreferences.individualInvestmentCollapseStates);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info', duration: number = 5000) => {
    const id = crypto.randomUUID();
    setActiveToast({ id, message, type, visible: true, duration });
  }, []);

  const closeToast = () => setActiveToast(null);

  const { investments, managedAssets } = appData;

  useEffect(() => {
    setAppData(prev => ({
      ...prev,
      preferences: {
        ...(prev.preferences || defaultUserPreferences), 
        collapsedAssetGroups,
        assetGroupSortConfig,
        showTerminatedInvestments,
        autoRefreshConfig,
        selectedFinancialYear,
        individualInvestmentCollapseStates,
      }
    }));
  }, [collapsedAssetGroups, assetGroupSortConfig, showTerminatedInvestments, autoRefreshConfig, selectedFinancialYear, individualInvestmentCollapseStates]);


  useEffect(() => {
    setIsInitialDataLoading(true);
    let loadedAppData: AppData = JSON.parse(JSON.stringify(defaultAppData)); 
    try {
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEYS.APP_DATA);
      if (storedDataString) {
        const parsedData = JSON.parse(storedDataString) as AppData;
        if (parsedData && Array.isArray(parsedData.investments) && Array.isArray(parsedData.managedAssets)) {
            loadedAppData = {
                investments: parsedData.investments || [],
                managedAssets: parsedData.managedAssets || [],
                preferences: { ...defaultUserPreferences, ...(parsedData.preferences || {}) },
                cachedApiData: { ...defaultCachedApiData, ...(parsedData.cachedApiData || {}) }
            };
        } else {
           console.warn("Local Storage: Parsed data is not valid AppData. Using defaults.");
        }
      }
    } catch (error) {
      console.error("Local Storage Load: Failed to parse data. Using defaults.", error);
    }
    
    const prefs = loadedAppData.preferences || defaultUserPreferences;
    setCollapsedAssetGroups(prefs.collapsedAssetGroups);
    setAssetGroupSortConfig(prefs.assetGroupSortConfig);
    setShowTerminatedInvestments(prefs.showTerminatedInvestments);
    setAutoRefreshConfig(prefs.autoRefreshConfig);
    setSelectedFinancialYear(prefs.selectedFinancialYear);
    setIndividualInvestmentCollapseStates(prefs.individualInvestmentCollapseStates);

    const loadedCache = loadedAppData.cachedApiData || defaultCachedApiData;
    const initialRate = loadedCache.exchangeRate;
    setUsdToAudRate(initialRate ?? null);

    const initialAssetPrices: Record<string, number | null> = {};
    let investmentsNeedUpdateFromCache = false;
    const updatedInvestmentsFromCache = [...loadedAppData.investments].map(inv => ({ ...inv }));


    loadedAppData.managedAssets.forEach(asset => {
        let audPrice: number | null = null;
        if (asset.type === InvestmentType.CRYPTO && loadedCache.cryptoPricesAUD && loadedCache.cryptoPricesAUD[asset.apiId] !== undefined) {
            audPrice = loadedCache.cryptoPricesAUD[asset.apiId];
        } else if (asset.type === InvestmentType.EQUITY && loadedCache.equityPricesUSD && typeof loadedCache.equityPricesUSD[asset.apiId] === 'number' && initialRate) {
            audPrice = loadedCache.equityPricesUSD[asset.apiId] * initialRate;
        }
        if (audPrice !== null) {
            initialAssetPrices[asset.id] = audPrice;
        }
    });
    setAssetCurrentPricesAUD(initialAssetPrices);

     updatedInvestmentsFromCache.forEach((inv, index) => {
        if (!inv.endDate && initialAssetPrices[inv.assetId] !== undefined && initialAssetPrices[inv.assetId] !== null) {
            if (inv.currentPricePerUnitAUD !== initialAssetPrices[inv.assetId]) {
                updatedInvestmentsFromCache[index] = { ...inv, currentPricePerUnitAUD: initialAssetPrices[inv.assetId]! };
                investmentsNeedUpdateFromCache = true;
            }
        }
    });

    if (investmentsNeedUpdateFromCache) {
        loadedAppData = { ...loadedAppData, investments: updatedInvestmentsFromCache };
    }
    
    setAppData(loadedAppData); 
    setIsInitialDataLoading(false);
  }, []); 


  useEffect(() => {
    if (isInitialDataLoading) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.APP_DATA, JSON.stringify(appData));
    } catch (error) {
      console.error("Local Storage Save: FAILED", error);
      showToast("Critical error: Failed to save data to local storage. Changes may be lost.", "error", 10000);
    }
  }, [appData, isInitialDataLoading, showToast]);

   useEffect(() => {
    const fetchAndSetConsolidatedPrices = async () => {
      if (!isInitialDataLoading && (usdToAudRate === null || Object.keys(assetCurrentPricesAUD).length === 0) && !isFetchingRate) {
        setIsFetchingRate(true);
        try {
          const cryptoIds = managedAssets.filter((a: ManagedAsset) => a.type === InvestmentType.CRYPTO).map((a: ManagedAsset) => a.apiId);
          const equityIds = managedAssets.filter((a: ManagedAsset) => a.type === InvestmentType.EQUITY).map((a: ManagedAsset) => a.apiId);
          const { cryptoPricesAUD, equityPricesUSD, usdToAudRate: fetchedRate } = await fetchConsolidatedPrices(cryptoIds, equityIds);
          setUsdToAudRate(fetchedRate);
          // Build assetCurrentPricesAUD
          const newAssetPrices: Record<string, number | null> = {};
          managedAssets.forEach((asset: ManagedAsset) => {
            if (asset.type === InvestmentType.CRYPTO && cryptoPricesAUD[asset.apiId]?.aud !== undefined) {
              newAssetPrices[asset.id] = cryptoPricesAUD[asset.apiId].aud;
            } else if (asset.type === InvestmentType.EQUITY && equityPricesUSD && typeof (equityPricesUSD as Record<string, number>)[asset.apiId] === 'number' && fetchedRate) {
              newAssetPrices[asset.id] = (equityPricesUSD as Record<string, number>)[asset.apiId] * fetchedRate;
            }
          });
          setAssetCurrentPricesAUD(newAssetPrices);
          setAppData((prev: AppData) => {
            // Convert cryptoPricesAUD to Record<string, number>
            const cryptoPricesAUDRecord: Record<string, number> = {};
            Object.entries(cryptoPricesAUD).forEach(([apiId, value]) => {
              if (value && typeof value.aud === 'number') {
                cryptoPricesAUDRecord[apiId] = value.aud;
              }
            });
            // equityPricesUSD is already Record<string, number> or compatible
            const equityPricesUSDRecord: Record<string, number> = {};
            if (equityPricesUSD && typeof equityPricesUSD === 'object') {
              Object.entries(equityPricesUSD as Record<string, number>).forEach(([apiId, value]) => {
                if (typeof value === 'number') {
                  equityPricesUSDRecord[apiId] = value;
                }
              });
            }
            return {
              ...prev,
              cachedApiData: {
                ...(prev.cachedApiData || defaultCachedApiData),
                cryptoPricesAUD: cryptoPricesAUDRecord,
                equityPricesUSD: equityPricesUSDRecord,
                exchangeRate: fetchedRate,
                syncTimestamps: {
                  ...(prev.cachedApiData?.syncTimestamps || {}),
                  exchangeRate: new Date().toISOString(),
                  crypto: new Date().toISOString(),
                  equities: new Date().toISOString(),
                }
              }
            };
          });
          showToast('Prices and exchange rate updated.', 'success', 3000);
        } catch (error) {
          showToast('Could not fetch consolidated prices. Data may be outdated.', 'error');
        } finally {
          setIsFetchingRate(false);
        }
      }
    };
    fetchAndSetConsolidatedPrices();
  }, [isInitialDataLoading, usdToAudRate, showToast, isFetchingRate, assetCurrentPricesAUD, managedAssets]); 


  const handleRestoreFromServer = async () => { 
    if (isAzureOperationLoading) return;
    if (!window.confirm("Are you sure you want to restore data from the server? This will overwrite your current local data.")) return;
    
    setIsAzureOperationLoading(true);
    showToast("Attempting to restore data from server...", 'info');
    try {
        const dataFromAzure = await downloadDataFromAzure();
        if (dataFromAzure) {
            const restoredData: AppData = {
                investments: dataFromAzure.investments || [],
                managedAssets: dataFromAzure.managedAssets || [],
                preferences: { ...defaultUserPreferences, ...(dataFromAzure.preferences || {}) },
                cachedApiData: { ...defaultCachedApiData, ...(dataFromAzure.cachedApiData || {}) }
            };
            
            const prefs = restoredData.preferences || defaultUserPreferences;
            setCollapsedAssetGroups(prefs.collapsedAssetGroups);
            setAssetGroupSortConfig(prefs.assetGroupSortConfig);
            setShowTerminatedInvestments(prefs.showTerminatedInvestments);
            setAutoRefreshConfig(prefs.autoRefreshConfig);
            setSelectedFinancialYear(prefs.selectedFinancialYear);
            setIndividualInvestmentCollapseStates(prefs.individualInvestmentCollapseStates);

            const loadedCache = restoredData.cachedApiData || defaultCachedApiData;
            const newRate = loadedCache.exchangeRate;
            setUsdToAudRate(newRate ?? null);
            
            const newAssetPrices: Record<string, number | null> = {};
            let investmentsNeedUpdateOnRestore = false;
            const updatedInvestmentsOnRestore = [...restoredData.investments].map(inv => ({...inv}));

            restoredData.managedAssets.forEach(asset => {
                let audPrice: number | null = null;
                if (asset.type === InvestmentType.CRYPTO && loadedCache.cryptoPricesAUD && loadedCache.cryptoPricesAUD[asset.apiId] !== undefined) {
                    audPrice = loadedCache.cryptoPricesAUD[asset.apiId];
                } else if (asset.type === InvestmentType.EQUITY && loadedCache.equityPricesUSD && typeof loadedCache.equityPricesUSD[asset.apiId] === 'number' && newRate) {
                    audPrice = loadedCache.equityPricesUSD[asset.apiId] * newRate;
                }
                if (audPrice !== null) newAssetPrices[asset.id] = audPrice;
            });
            setAssetCurrentPricesAUD(newAssetPrices);

            updatedInvestmentsOnRestore.forEach((inv, index) => {
                if (!inv.endDate && newAssetPrices[inv.assetId] !== undefined && newAssetPrices[inv.assetId] !== null) {
                   if(inv.currentPricePerUnitAUD !== newAssetPrices[inv.assetId]) {
                     updatedInvestmentsOnRestore[index] = { ...inv, currentPricePerUnitAUD: newAssetPrices[inv.assetId]! };
                     investmentsNeedUpdateOnRestore = true;
                   }
                }
            });
            
            setAppData({ ...restoredData, investments: investmentsNeedUpdateOnRestore ? updatedInvestmentsOnRestore : restoredData.investments});
            showToast("Data successfully restored from server and saved locally.", 'success');
        } else {
            showToast("No data found on server or download failed. Local data remains unchanged.", 'info');
        }
    } catch (error: any) {
        showToast(`Error restoring from server: ${error.message}`, 'error');
    } finally {
        setIsAzureOperationLoading(false);
    }
  };

  const handleBackupToServer = async () => { 
    if (isAzureOperationLoading) return;
     if (!window.confirm("Are you sure you want to backup current local data to the server? This will overwrite the main file on the server and create a new backup.")) return;
    
    setIsAzureOperationLoading(true);
    showToast("Attempting to backup data to server...", 'info');
    try {
        await uploadDataToAzure(appData); 
        showToast("Data successfully backed up to server.", 'success');
    } catch (error: any) {
        showToast(`Error backing up to server: ${error.message}`, 'error');
    } finally {
        setIsAzureOperationLoading(false);
    }
  };

  const updateAllCurrentValues = useCallback(async (isManualRefresh: boolean = false) => {
    if (isInitialDataLoading || appData.managedAssets.length === 0) return; 
    if (!isManualRefresh && !autoRefreshConfig.enabled) {
      setCurrentlyFetchingAssetApiIds(new Set());
      return;
    }
    const now = Date.now();
    if (now - lastPriceFetchAttemptTimestamp < 60000 && !isManualRefresh) {
      setCurrentlyFetchingAssetApiIds(new Set());
      return;
    }
    if (isManualRefresh && now - lastPriceFetchAttemptTimestamp < 5000) {
      showToast("Manual refresh triggered too soon. Please wait.", 'info', 3000);
      return;
    }
    setLastPriceFetchAttemptTimestamp(Date.now());
    const cryptoAssetApiIdsToFetch: string[] = [];
    const equityAssetApiIdsToFetch: string[] = [];
    const allManagedApiIdsForSpinner: string[] = [];
    appData.managedAssets.forEach((asset: ManagedAsset) => {
      allManagedApiIdsForSpinner.push(asset.apiId);
      if (asset.type === InvestmentType.CRYPTO && !cryptoAssetApiIdsToFetch.includes(asset.apiId)) {
        cryptoAssetApiIdsToFetch.push(asset.apiId);
      } else if (asset.type === InvestmentType.EQUITY && !equityAssetApiIdsToFetch.includes(asset.apiId)) {
        equityAssetApiIdsToFetch.push(asset.apiId);
      }
    });
    if (cryptoAssetApiIdsToFetch.length === 0 && equityAssetApiIdsToFetch.length === 0) {
      setCurrentlyFetchingAssetApiIds(new Set());
      return;
    }
    setCurrentlyFetchingAssetApiIds(new Set(allManagedApiIdsForSpinner));
    try {
      const { cryptoPricesAUD, equityPricesUSD, usdToAudRate: fetchedRate } = await fetchConsolidatedPrices(cryptoAssetApiIdsToFetch, equityAssetApiIdsToFetch);
      setUsdToAudRate(fetchedRate);
      const newLiveAssetPricesAUD: Record<string, number | null> = { ...assetCurrentPricesAUD };
      // cryptoPricesAUD is { [apiId: string]: { aud: number } }
      appData.managedAssets.forEach((asset: ManagedAsset) => {
        if (asset.type === InvestmentType.CRYPTO && cryptoPricesAUD[asset.apiId]?.aud !== undefined) {
          newLiveAssetPricesAUD[asset.id] = cryptoPricesAUD[asset.apiId].aud;
        } else if (asset.type === InvestmentType.EQUITY && equityPricesUSD && typeof (equityPricesUSD as Record<string, number>)[asset.apiId] === 'number' && fetchedRate) {
          newLiveAssetPricesAUD[asset.id] = (equityPricesUSD as Record<string, number>)[asset.apiId] * fetchedRate;
        }
      });
      setAssetCurrentPricesAUD(newLiveAssetPricesAUD);
      let newPricesAppliedToInvestments = false;
      let updatedInvestmentsList = appData.investments.map((inv: Investment) => {
        if (!inv.endDate) {
          const latestAssetPriceAUD = newLiveAssetPricesAUD[inv.assetId];
          if (latestAssetPriceAUD !== undefined && latestAssetPriceAUD !== null) {
            if (inv.currentPricePerUnitAUD !== latestAssetPriceAUD) {
              newPricesAppliedToInvestments = true;
              return { ...inv, currentPricePerUnitAUD: latestAssetPriceAUD };
            }
          }
        }
        return inv;
      });
      setAppData((prev: AppData) => {
        // Convert cryptoPricesAUD to Record<string, number>
        const cryptoPricesAUDRecord: Record<string, number> = {};
        Object.entries(cryptoPricesAUD).forEach(([apiId, value]) => {
          if (value && typeof value.aud === 'number') {
            cryptoPricesAUDRecord[apiId] = value.aud;
          }
        });
        // equityPricesUSD is already Record<string, number> or compatible
        const equityPricesUSDRecord: Record<string, number> = {};
        if (equityPricesUSD && typeof equityPricesUSD === 'object') {
          Object.entries(equityPricesUSD as Record<string, number>).forEach(([apiId, value]) => {
            if (typeof value === 'number') {
              equityPricesUSDRecord[apiId] = value;
            }
          });
        }
        return {
          ...prev,
          investments: newPricesAppliedToInvestments ? updatedInvestmentsList : prev.investments,
          cachedApiData: {
            ...(prev.cachedApiData || defaultCachedApiData),
            cryptoPricesAUD: cryptoPricesAUDRecord,
            equityPricesUSD: equityPricesUSDRecord,
            exchangeRate: fetchedRate,
            syncTimestamps: {
              ...(prev.cachedApiData?.syncTimestamps || {}),
              exchangeRate: new Date().toISOString(),
              crypto: new Date().toISOString(),
              equities: new Date().toISOString(),
            }
          }
        };
      });
      setCurrentlyFetchingAssetApiIds(new Set());
      showToast('Prices and exchange rate updated.', 'success', 3000);
    } catch (error) {
      setCurrentlyFetchingAssetApiIds(new Set());
      showToast('Failed to fetch consolidated prices.', 'error');
    }
  }, [appData.investments, appData.managedAssets, isInitialDataLoading, lastPriceFetchAttemptTimestamp, autoRefreshConfig.enabled, showToast, assetCurrentPricesAUD, appData.cachedApiData]);


  useEffect(() => {
    if (!isInitialDataLoading && autoRefreshConfig.enabled && !isFetchingRate) {
        updateAllCurrentValues(); 
        const intervalId = setInterval(() => updateAllCurrentValues(false), 60 * 1000); 
        return () => clearInterval(intervalId);
    }
  }, [updateAllCurrentValues, isInitialDataLoading, autoRefreshConfig.enabled, isFetchingRate]);


  const handleAddInvestment = (formSubmitData: InvestmentFormSubmitData) => {
    const { priceInputValue, priceInputCurrency, notes, ...formDataRest } = formSubmitData;
    const selectedAsset = appData.managedAssets.find(a => a.id === formDataRest.assetId);

    if (!selectedAsset) {
        showToast("Selected asset is invalid.", 'error');
        return;
    }

    let finalPriceOnInvestmentAUD = priceInputValue;
    if (priceInputCurrency === 'USD') {
        if (!usdToAudRate) {
            showToast("USD/AUD exchange rate is not available. Cannot convert price.", 'error', 7000);
            return;
        }
        finalPriceOnInvestmentAUD = priceInputValue * usdToAudRate;
    }
    
    const currentPriceForNewInv = assetCurrentPricesAUD[selectedAsset.id] ?? finalPriceOnInvestmentAUD;

    const newInvestment: Investment = {
      ...formDataRest,
      id: crypto.randomUUID(),
      type: selectedAsset.type,
      priceOnInvestmentAUD: finalPriceOnInvestmentAUD,
      currentPricePerUnitAUD: currentPriceForNewInv,
      isFlagged: false,
      notes: notes,
    };
    setAppData(prev => ({ ...prev, investments: [...prev.investments, newInvestment] }));
    setIsFormOpen(false);
    setDefaultPreselectedAssetId(undefined); 
    showToast(`Investment in "${selectedAsset.userGivenName}" added.`, 'success');
  };

  const handleUpdateInvestment = (formSubmitData: InvestmentFormSubmitData, id: string) => {
    const { priceInputValue, priceInputCurrency, notes, ...formDataRest } = formSubmitData;
    const selectedAsset = appData.managedAssets.find(a => a.id === formDataRest.assetId);

    if (!selectedAsset) {
        showToast("Selected asset is invalid.", 'error');
        return;
    }
    const existingInvestment = appData.investments.find(inv => inv.id === id);
    if (!existingInvestment) {
        showToast("Investment to update not found.", 'error');
        return;
    }
    if (existingInvestment.endDate && !formDataRest.endDate) {
      showToast("Cannot reactivate a terminated investment through this form.", "error");
      return;
    }
    if (existingInvestment.endDate && formDataRest.endDate && existingInvestment.endDate !== formDataRest.endDate) {
        showToast("Cannot change the end date of an already terminated investment.", "error", 7000);
        return;
    }

    let finalPriceOnInvestmentAUDFromForm = priceInputValue; 
    if (priceInputCurrency === 'USD') { 
        if (!usdToAudRate) {
            showToast("USD/AUD exchange rate is not available.", 'error', 7000);
            return;
        }
        finalPriceOnInvestmentAUDFromForm = priceInputValue * usdToAudRate;
    }

    let newCurrentPriceAUD = existingInvestment.currentPricePerUnitAUD; 
    let newPriceOnInvestmentAUD = existingInvestment.priceOnInvestmentAUD;

    if (formDataRest.endDate) { 
        newCurrentPriceAUD = finalPriceOnInvestmentAUDFromForm; 
    } else { 
        newPriceOnInvestmentAUD = finalPriceOnInvestmentAUDFromForm; 
    }


    const updatedInvestment: Investment = {
        ...existingInvestment,
        ...formDataRest,
        id: id, 
        type: selectedAsset.type, 
        priceOnInvestmentAUD: newPriceOnInvestmentAUD, 
        currentPricePerUnitAUD: newCurrentPriceAUD,
        notes: notes,
    };

    setAppData(prev => ({ ...prev, investments: prev.investments.map(inv => inv.id === id ? updatedInvestment : inv) }));
    setIsFormOpen(false);
    setEditingInvestment(null);
    setDefaultPreselectedAssetId(undefined); 
    showToast(`Investment in "${selectedAsset.userGivenName}" updated.`, 'success');
  };

  const handleToggleFlagInvestment = (investmentId: string) => {
    setAppData(prev => ({
      ...prev,
      investments: prev.investments.map(inv => 
        inv.id === investmentId ? { ...inv, isFlagged: !inv.isFlagged } : inv
      )
    }));
  };

  const handleToggleInvestmentCollapse = (investmentId: string) => {
    setIndividualInvestmentCollapseStates(prev => ({
      ...prev,
      [investmentId]: !(prev[investmentId] ?? false)
    }));
  };

  const filteredInvestmentsForList = useMemo(() => {
    let result = investments;
    if (selectedFinancialYear !== ALL_TIME_FY) {
        const [startYearStr, endYearStr] = selectedFinancialYear.split('-');
        const fyNextJulyFirstUTC = Date.UTC(parseInt(endYearStr, 10), 6, 1);
        const fyStartDateUTC = Date.UTC(parseInt(startYearStr, 10), 6, 1);
        if (isNaN(fyStartDateUTC) || isNaN(fyNextJulyFirstUTC)) return []; 
        result = result.filter(inv => {
            if (!inv.endDate) return false; 
            const invEndDateObj = new Date(inv.endDate);
            if (isNaN(invEndDateObj.getTime())) return false; 
            const invEndDateNum = invEndDateObj.getTime(); 
            return invEndDateNum >= fyStartDateUTC && invEndDateNum < fyNextJulyFirstUTC;
        });
    } else { 
      if (!showTerminatedInvestments) {
        result = result.filter(inv => !inv.endDate);
      }
    }
    return result;
  }, [investments, showTerminatedInvestments, selectedFinancialYear]);

  useEffect(() => {
    if (isInitialDataLoading) return;

    const investmentsByAsset: Record<string, Investment[]> = {};
    filteredInvestmentsForList.forEach(inv => {
        if (!investmentsByAsset[inv.assetId]) investmentsByAsset[inv.assetId] = [];
        investmentsByAsset[inv.assetId].push(inv);
    });

    let updatedCollapseStates = { ...individualInvestmentCollapseStates };
    let changed = false;

    Object.keys(investmentsByAsset).forEach(assetId => {
        if (investmentsByAsset[assetId].length > 3) {
            investmentsByAsset[assetId].forEach(inv => {
                if (updatedCollapseStates[inv.id] === undefined) {
                    updatedCollapseStates[inv.id] = true;
                    changed = true;
                }
            });
        }
    });

    if (changed) {
        setIndividualInvestmentCollapseStates(updatedCollapseStates);
    }
  }, [filteredInvestmentsForList, isInitialDataLoading, individualInvestmentCollapseStates]);


  const handleSubmitForm = (data: InvestmentFormSubmitData, id?: string) => {
    if (id) handleUpdateInvestment(data, id);
    else handleAddInvestment(data);
  };
  const handleEditInvestment = (id: string) => {
    const investmentToEdit = appData.investments.find(inv => inv.id === id);
    if (investmentToEdit) {
      setEditingInvestment(investmentToEdit);
      setDefaultPreselectedAssetId(undefined); 
      setIsFormOpen(true);
    }
  };
  const handleDeleteInvestment = (id: string) => {
    if (window.confirm('Are you sure you want to delete this investment?')) {
        setAppData(prev => ({ ...prev, investments: prev.investments.filter(inv => inv.id !== id) }));
        setIndividualInvestmentCollapseStates(prevStates => {
            const newStates = {...prevStates};
            delete newStates[id];
            return newStates;
        });
        showToast('Investment deleted.', 'success');
    }
  };
  const openFormForNew = (options?: { defaultAssetId?: string }) => { 
    setEditingInvestment(null);
    setDefaultPreselectedAssetId(options?.defaultAssetId);
    setIsFormOpen(true);
  };
  const handleAddNewInvestmentForAsset = (assetId: string) => { 
      openFormForNew({ defaultAssetId: assetId });
  };

  const handleAddManagedAsset = (assetData: Omit<ManagedAsset, 'id'>) => {
    if (appData.managedAssets.some(a => a.apiId.toLowerCase() === assetData.apiId.toLowerCase() && a.type === assetData.type)) {
        showToast(`Asset with API ID "${assetData.apiId}" and type "${assetData.type}" already exists.`, 'error', 7000);
        return;
    }
    const newAssetId = generateAssetId(assetData.apiId, assetData.type);
    if (appData.managedAssets.some(a => a.id === newAssetId)) {
        showToast(`Generated internal ID "${newAssetId}" already exists.`, 'error', 7000);
        return;
    }
    const newAsset: ManagedAsset = { ...assetData, id: newAssetId };
    setAppData(prev => ({
        ...prev, 
        managedAssets: [...prev.managedAssets, newAsset],
        cachedApiData: {
            ...(prev.cachedApiData || defaultCachedApiData),
            cryptoPricesAUD: { ...(prev.cachedApiData?.cryptoPricesAUD || {})},
            equityPricesUSD: { ...(prev.cachedApiData?.equityPricesUSD || {})},
        }
    }));
    updateAllCurrentValues(true); 
    showToast(`Asset "${newAsset.userGivenName}" added.`, 'success');
  };
  const handleDeleteManagedAsset = (id: string) => {
    const assetToDelete = appData.managedAssets.find(asset => asset.id === id);
    if (!assetToDelete) return;

    if (appData.investments.some(inv => inv.assetId === id)) {
      showToast('Cannot delete asset: It is used in investments.', 'error', 7000);
      return;
    }
    if (!window.confirm('Are you sure you want to delete this managed asset?')) return;

    setAppData(prev => {
        const newManagedAssets = prev.managedAssets.filter(asset => asset.id !== id);
        const newCryptoPrices = { ...(prev.cachedApiData?.cryptoPricesAUD || {}) };
        const newEquityPricesUSD = { ...(prev.cachedApiData?.equityPricesUSD || {}) };
        if (assetToDelete.type === InvestmentType.CRYPTO) delete newCryptoPrices[assetToDelete.apiId];
        if (assetToDelete.type === InvestmentType.EQUITY) delete newEquityPricesUSD[assetToDelete.apiId];

        return {
            ...prev, 
            managedAssets: newManagedAssets,
            cachedApiData: {
                ...(prev.cachedApiData || defaultCachedApiData),
                cryptoPricesAUD: newCryptoPrices,
                equityPricesUSD: newEquityPricesUSD,
            }
        };
    });
    setCollapsedAssetGroups(prev => { const copy = {...prev}; delete copy[id]; return copy; });
    setAssetCurrentPricesAUD(prev => { const copy = {...prev}; delete copy[id]; return copy; });
    showToast(`Managed asset deleted.`, 'success');
  };
  const handleEditManagedAsset = (assetId: string) => setEditingManagedAssetId(assetId);
  const handleCancelEditManagedAsset = () => setEditingManagedAssetId(null);
  const handleUpdateManagedAsset = (assetIdToUpdate: string, updatedAssetData: Omit<ManagedAsset, 'id'>) => {
    const originalAssetBeingEdited = appData.managedAssets.find(a => a.id === assetIdToUpdate);
    if (!originalAssetBeingEdited) {
        showToast("Error: Asset being edited not found.", "error"); return;
    }
    const conflictingAsset = appData.managedAssets.find(asset =>
        asset.id !== assetIdToUpdate &&
        asset.apiId.toLowerCase() === updatedAssetData.apiId.toLowerCase() &&
        asset.type === updatedAssetData.type
    );
    if (conflictingAsset) {
        showToast(`Cannot update. Another asset uses API ID "${updatedAssetData.apiId}" and type "${updatedAssetData.type}".`, 'error', 7000); return;
    }
    const newGeneratedId = generateAssetId(updatedAssetData.apiId, updatedAssetData.type);
    if (newGeneratedId !== assetIdToUpdate && appData.managedAssets.some(asset => asset.id === newGeneratedId)) {
      showToast(`Cannot update. New API ID/Type results in an internal ID ("${newGeneratedId}") already in use.`, 'error', 7000); return;
    }

    let investmentsNeedAssetIdUpdate = false;
    let investmentsMayNeedPriceRefresh = false;

    setAppData(prev => {
      const updatedManagedAssets = prev.managedAssets.map(asset => {
        if (asset.id === assetIdToUpdate) {
          if(asset.apiId !== updatedAssetData.apiId || asset.type !== updatedAssetData.type) {
            if (newGeneratedId !== assetIdToUpdate) investmentsNeedAssetIdUpdate = true;
            if (prev.investments.some(inv => inv.assetId === assetIdToUpdate && !inv.endDate)) investmentsMayNeedPriceRefresh = true;
          }
          return { ...updatedAssetData, id: newGeneratedId }; 
        }
        return asset;
      });

      let updatedInvestments = prev.investments;
      if (investmentsNeedAssetIdUpdate) {
        updatedInvestments = prev.investments.map(inv => {
          if (inv.assetId === assetIdToUpdate) {
            let newCurrentPrice = inv.currentPricePerUnitAUD;
            if(!inv.endDate && investmentsMayNeedPriceRefresh) newCurrentPrice = inv.priceOnInvestmentAUD; 
            return { ...inv, assetId: newGeneratedId, type: updatedAssetData.type, currentPricePerUnitAUD: newCurrentPrice };
          }
          return inv;
        });
      } else if (investmentsMayNeedPriceRefresh) { 
         updatedInvestments = prev.investments.map(inv => {
           if (inv.assetId === assetIdToUpdate && !inv.endDate) {
             return { ...inv, currentPricePerUnitAUD: inv.priceOnInvestmentAUD, type: updatedAssetData.type };
           }
           return inv;
         });
      }
      
      const newCachedCrypto = { ...(prev.cachedApiData?.cryptoPricesAUD || {}) };
      const newCachedEquity = { ...(prev.cachedApiData?.equityPricesUSD || {}) };
      let cachedDataChanged = false;

      if (originalAssetBeingEdited.apiId !== updatedAssetData.apiId || originalAssetBeingEdited.type !== updatedAssetData.type) {
        if (originalAssetBeingEdited.type === InvestmentType.CRYPTO && newCachedCrypto[originalAssetBeingEdited.apiId] !== undefined) {
            delete newCachedCrypto[originalAssetBeingEdited.apiId];
            cachedDataChanged = true;
        } else if (originalAssetBeingEdited.type === InvestmentType.EQUITY && newCachedEquity[originalAssetBeingEdited.apiId] !== undefined) {
            delete newCachedEquity[originalAssetBeingEdited.apiId];
            cachedDataChanged = true;
        }
      }
      
      return { 
          ...prev, 
          managedAssets: updatedManagedAssets, 
          investments: updatedInvestments,
          cachedApiData: cachedDataChanged ? {
              ...(prev.cachedApiData || defaultCachedApiData),
              cryptoPricesAUD: newCachedCrypto,
              equityPricesUSD: newCachedEquity
          } : prev.cachedApiData
      };
    });

    if (newGeneratedId !== assetIdToUpdate && collapsedAssetGroups.hasOwnProperty(assetIdToUpdate)) {
      setCollapsedAssetGroups(prev => {
        const copy = {...prev};
        copy[newGeneratedId] = copy[assetIdToUpdate];
        delete copy[assetIdToUpdate];
        return copy;
      });
    }
    if (newGeneratedId !== assetIdToUpdate && assetCurrentPricesAUD[assetIdToUpdate] !== undefined) {
        setAssetCurrentPricesAUD(prevPrices => {
            const newPrices = {...prevPrices};
            newPrices[newGeneratedId] = newPrices[assetIdToUpdate];
            delete newPrices[assetIdToUpdate];
            return newPrices;
        });
    }

    setEditingManagedAssetId(null);
    if (investmentsMayNeedPriceRefresh || (originalAssetBeingEdited.apiId !== updatedAssetData.apiId || originalAssetBeingEdited.type !== updatedAssetData.type)) {
        setLastPriceFetchAttemptTimestamp(0); 
        updateAllCurrentValues(true); 
    }
    showToast(`Asset "${updatedAssetData.userGivenName}" updated.`, 'success');
  };

  const editingAssetCurrentData = useMemo(() => {
    if (!editingManagedAssetId) return null;
    return managedAssets.find(asset => asset.id === editingManagedAssetId) || null;
  }, [editingManagedAssetId, managedAssets]);

  const financialYearOptions = useMemo(() => { 
    const options: { value: FinancialYear, label: string }[] = [{ value: ALL_TIME_FY, label: "All Time (Default)" }];
    const uniqueFYsWithData = new Set<string>();
    investments.forEach(inv => {
        if (inv.endDate) {
            const invEndDateObj = new Date(inv.endDate);
            const invMonth = invEndDateObj.getUTCMonth(); 
            const invYear = invEndDateObj.getUTCFullYear();
            const endFYYear = invMonth >= 6 ? invYear + 1 : invYear; 
            const startFYYear = endFYYear - 1;
            uniqueFYsWithData.add(`${startFYYear}-${endFYYear}`);
        }
    });
    const sortedFYs = Array.from(uniqueFYsWithData).sort((a,b) => b.localeCompare(a));
    sortedFYs.forEach(fyValue => options.push({ value: fyValue, label: `FY ${fyValue}` }));
    return options;
  }, [investments]);

  const sortedManagedAssetsForList = useMemo(() => {
    const assetsWithSortData = managedAssets.map(asset => {
        const groupInvestments = filteredInvestmentsForList.filter(inv => inv.assetId === asset.id);
        let sortValue: any;
        const { key, direction } = assetGroupSortConfig;
        switch (key) {
            case 'latestInvestmentDate':
                sortValue = groupInvestments.length > 0 ? Math.max(...groupInvestments.map(inv => new Date(inv.startDate).getTime() || 0)) : (direction === 'asc' ? Infinity : -Infinity);
                break;
            case 'oldestInvestmentDate':
                sortValue = groupInvestments.length > 0 ? Math.min(...groupInvestments.map(inv => new Date(inv.startDate).getTime() || Infinity)) : (direction === 'asc' ? Infinity : -Infinity);
                break;
            case 'totalInvestedValue':
                const allActiveForAsset = investments.filter(inv => inv.assetId === asset.id && !inv.endDate);
                sortValue = allActiveForAsset.reduce((sum, inv) => sum + (inv.units * inv.priceOnInvestmentAUD), 0);
                break;
            case 'assetName': default: sortValue = asset.userGivenName.toLowerCase(); break;
        }
        return { ...asset, sortValue, hasInvestmentsInCurrentFilter: groupInvestments.length > 0 };
    });
    const relevantAssets = assetsWithSortData.filter(a => a.hasInvestmentsInCurrentFilter);
    return relevantAssets.sort((a, b) => {
        const { key, direction } = assetGroupSortConfig;
        if (key === 'assetName') return direction === 'asc' ? a.sortValue.localeCompare(b.sortValue) : b.sortValue.localeCompare(a.sortValue);
        if (typeof a.sortValue === 'number' && typeof b.sortValue === 'number') return direction === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue;
        if (a.sortValue < b.sortValue) return direction === 'asc' ? -1 : 1;
        if (a.sortValue > b.sortValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [managedAssets, filteredInvestmentsForList, assetGroupSortConfig, investments]);

  const summaryStats = useMemo(() => { 
    const activeInvestmentsOnly = investments.filter(inv => !inv.endDate);
    const investmentValue = activeInvestmentsOnly.reduce((acc, inv) => acc + (inv.units * inv.priceOnInvestmentAUD), 0);
    const portfolioValue = activeInvestmentsOnly.reduce((acc, inv) => acc + (inv.units * inv.currentPricePerUnitAUD), 0);
    const portfolioPandL = portfolioValue - investmentValue;
    const portfolioPandLPercentage = investmentValue > 0 ? (portfolioPandL / investmentValue) * 100 : 0;
    const realisedPandLAllTime = investments
        .filter(inv => !!inv.endDate) 
        .reduce((acc, inv) => acc + ((inv.units * inv.currentPricePerUnitAUD) - (inv.units * inv.priceOnInvestmentAUD)), 0);
    
    // Calculate totalUnits for the main summary (all active investments)
    const totalActiveUnits = activeInvestmentsOnly.reduce((acc, inv) => acc + inv.units, 0);

    return { 
        investmentValue, 
        portfolioValue, 
        portfolioPandL, 
        portfolioPandLPercentage, 
        realisedPandLAllTime,
        totalUnits: totalActiveUnits, // Added total units for main summary, though not explicitly displayed there yet.
        // assetType is not relevant for the overall summary.
    } as SummaryStatsData;
  }, [investments]);

  const categorizedSummaryStats = useMemo((): CategorizedSummaryStats => {
    const activeInvestments = investments.filter(inv => !inv.endDate);
    const emptyStats: SummaryStatsData = { investmentValue: 0, portfolioValue: 0, portfolioPandL: 0, portfolioPandLPercentage: 0, realisedPandLAllTime: 0, totalUnits: 0 };

    const bitcoinStats = activeInvestments.reduce((acc, inv) => {
        const asset = managedAssets.find(ma => ma.id === inv.assetId);
        if (asset && asset.apiId.toLowerCase() === 'bitcoin' && asset.type === InvestmentType.CRYPTO) {
            acc.investmentValue += inv.units * inv.priceOnInvestmentAUD;
            acc.portfolioValue += inv.units * inv.currentPricePerUnitAUD;
            acc.totalUnits = (acc.totalUnits || 0) + inv.units;
        }
        return acc;
    }, { ...emptyStats, assetType: InvestmentType.CRYPTO });

    const altcoinsStats = activeInvestments.reduce((acc, inv) => {
        const asset = managedAssets.find(ma => ma.id === inv.assetId);
        if (asset && asset.apiId.toLowerCase() !== 'bitcoin' && asset.type === InvestmentType.CRYPTO) {
            acc.investmentValue += inv.units * inv.priceOnInvestmentAUD;
            acc.portfolioValue += inv.units * inv.currentPricePerUnitAUD;
            acc.totalUnits = (acc.totalUnits || 0) + inv.units;
        }
        return acc;
    }, { ...emptyStats, assetType: InvestmentType.CRYPTO });

    const equitiesStats = activeInvestments.reduce((acc, inv) => {
        if (inv.type === InvestmentType.EQUITY) {
            acc.investmentValue += inv.units * inv.priceOnInvestmentAUD;
            acc.portfolioValue += inv.units * inv.currentPricePerUnitAUD;
            acc.totalUnits = (acc.totalUnits || 0) + inv.units;
        }
        return acc;
    }, { ...emptyStats, assetType: InvestmentType.EQUITY });

    const calculatePandL = (stats: SummaryStatsData) => {
        stats.portfolioPandL = stats.portfolioValue - stats.investmentValue;
        stats.portfolioPandLPercentage = stats.investmentValue > 0 ? (stats.portfolioPandL / stats.investmentValue) * 100 : 0;
        return stats;
    };

    return {
        bitcoin: calculatePandL(bitcoinStats),
        altcoins: calculatePandL(altcoinsStats),
        equities: calculatePandL(equitiesStats),
    };
  }, [investments, managedAssets]);


  const handleExportData = () => {
    const jsonString = JSON.stringify(appData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'investment-tracker-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    showToast('Data exported as JSON successfully!', 'success');
  };
  const handleExportToCSV = () => { 
    let csvContent = "Asset Name,Asset API ID,Asset Type,Investment Start Date (UTC ISO),Total Units,Price on Investment (AUD),Invested Value (AUD),Investment End Date (UTC ISO),Current/Last Price (AUD),Current/Terminated Value (AUD),P/L (AUD),Flagged,Notes\n";
    const investmentsToExport = filteredInvestmentsForList;
    investmentsToExport.forEach(inv => {
        const asset = managedAssets.find(a => a.id === inv.assetId);
        const investedValue = inv.units * inv.priceOnInvestmentAUD;
        const currentOrTerminatedValue = inv.units * inv.currentPricePerUnitAUD;
        const pandl = currentOrTerminatedValue - investedValue;
        const notesCsv = inv.notes ? `"${inv.notes.replace(/"/g, '""')}"` : "";
        const row = [
            `"${asset?.userGivenName.replace(/"/g, '""') || "Unknown"}"`,
            `"${asset?.apiId.replace(/"/g, '""') || "N/A"}"`,
            asset?.type || "N/A", inv.startDate, inv.units, inv.priceOnInvestmentAUD, investedValue,
            inv.endDate || "Active", inv.currentPricePerUnitAUD, currentOrTerminatedValue, pandl,
            inv.isFlagged ? "Yes" : "No",
            notesCsv
        ].join(',');
        csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `investment_export_${selectedFinancialYear === ALL_TIME_FY ? "all_time" : selectedFinancialYear}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
    }
     showToast('Data exported as CSV.', 'success');
  };
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Are you sure? This will replace ALL current local data.')) {
      if(importFileRef.current) importFileRef.current.value = ""; return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const importedData = JSON.parse(text) as AppData;
        if (Array.isArray(importedData.investments) && Array.isArray(importedData.managedAssets)) {
            const validatedImportData: AppData = {
                investments: importedData.investments.map(inv => ({...inv, isFlagged: inv.isFlagged || false, notes: inv.notes || ""})),
                managedAssets: importedData.managedAssets,
                preferences: { ...defaultUserPreferences, ...(importedData.preferences || {}) },
                cachedApiData: { ...defaultCachedApiData, ...(importedData.cachedApiData || {}) }
            };
            const prefs = validatedImportData.preferences || defaultUserPreferences;
            setCollapsedAssetGroups(prefs.collapsedAssetGroups);
            setAssetGroupSortConfig(prefs.assetGroupSortConfig);
            setShowTerminatedInvestments(prefs.showTerminatedInvestments);
            setAutoRefreshConfig(prefs.autoRefreshConfig);
            setSelectedFinancialYear(prefs.selectedFinancialYear);
            setIndividualInvestmentCollapseStates(prefs.individualInvestmentCollapseStates);

            const loadedCache = validatedImportData.cachedApiData || defaultCachedApiData;
            const importedRate = loadedCache.exchangeRate;
            setUsdToAudRate(importedRate ?? null);
            
            const importedAssetPrices: Record<string, number | null> = {};
            let investmentsNeedUpdateOnImport = false;
            const updatedInvestmentsOnImport = [...validatedImportData.investments].map(inv => ({...inv}));

            validatedImportData.managedAssets.forEach(asset => {
                let audPrice: number | null = null;
                if (asset.type === InvestmentType.CRYPTO && loadedCache.cryptoPricesAUD && loadedCache.cryptoPricesAUD[asset.apiId] !== undefined) {
                    audPrice = loadedCache.cryptoPricesAUD[asset.apiId];
                } else if (asset.type === InvestmentType.EQUITY && loadedCache.equityPricesUSD && typeof loadedCache.equityPricesUSD[asset.apiId] === 'number' && importedRate) {
                    audPrice = loadedCache.equityPricesUSD[asset.apiId] * importedRate;
                }
                if (audPrice !== null) importedAssetPrices[asset.id] = audPrice;
            });
            setAssetCurrentPricesAUD(importedAssetPrices);

            updatedInvestmentsOnImport.forEach((inv, index) => {
                 if (!inv.endDate && importedAssetPrices[inv.assetId] !== undefined && importedAssetPrices[inv.assetId] !== null) {
                    if(inv.currentPricePerUnitAUD !== importedAssetPrices[inv.assetId]) {
                        updatedInvestmentsOnImport[index] = { ...inv, currentPricePerUnitAUD: importedAssetPrices[inv.assetId]! };
                        investmentsNeedUpdateOnImport = true;
                    }
                }
            });
            setAppData({...validatedImportData, investments: investmentsNeedUpdateOnImport ? updatedInvestmentsOnImport : validatedImportData.investments });
            updateAllCurrentValues(true); 
            showToast('Data imported and saved locally.', 'success');
        } else throw new Error('Invalid file format.');
      } catch (error: any) { showToast(`Failed to import data: ${error.message}`, 'error');
      } finally { if(importFileRef.current) importFileRef.current.value = ""; }
    };
    reader.readAsText(file);
  };

  const handleToggleAssetGroupCollapse = (assetId: string) => setCollapsedAssetGroups(prev => ({ ...prev, [assetId]: !(prev[assetId] ?? true) }));
  const handleChangeSortConfig = (key: AssetGroupSortKey, direction: SortDirection) => setAssetGroupSortConfig({ key, direction });
  const handleToggleShowTerminated = () => {
    const newShowTerminated = !showTerminatedInvestments;
    setShowTerminatedInvestments(newShowTerminated);
    if (!newShowTerminated && selectedFinancialYear !== ALL_TIME_FY) {
        setSelectedFinancialYear(ALL_TIME_FY);
        showToast("FY filter reset as terminated investments are hidden.", 'info', 4000);
    }
  };
  const handleToggleAutoRefresh = () => setAutoRefreshConfig(prev => ({ ...prev, enabled: !prev.enabled }));
  const handleManualRefresh = () => updateAllCurrentValues(true);
  const handleOpenWithdrawModal = (investmentId: string) => {
    const inv = investments.find(i => i.id === investmentId);
    if (inv && !inv.endDate) { setWithdrawingInvestment(inv); setIsWithdrawModalOpen(true); }
    else if (inv?.endDate) showToast("Cannot withdraw from a terminated investment.", 'info');
  };
  const handleConfirmWithdraw = (formData: WithdrawFormData) => {
    if (!withdrawingInvestment) return;
    const { unitsToWithdraw, withdrawalDateTime, priceAtWithdrawal } = formData;
    let updatedInvestmentsList = [...appData.investments];
    if (unitsToWithdraw >= withdrawingInvestment.units) { 
        updatedInvestmentsList = updatedInvestmentsList.map(inv =>
            inv.id === withdrawingInvestment.id
            ? { ...inv, endDate: withdrawalDateTime, currentPricePerUnitAUD: priceAtWithdrawal, units: inv.units } 
            : inv
        );
    } else { 
        const remainingUnits = withdrawingInvestment.units - unitsToWithdraw;
        const terminatedPortion: Investment = { 
            ...withdrawingInvestment, id: crypto.randomUUID(), units: unitsToWithdraw,
            endDate: withdrawalDateTime, currentPricePerUnitAUD: priceAtWithdrawal,
        };
        updatedInvestmentsList = updatedInvestmentsList.map(inv => 
            inv.id === withdrawingInvestment!.id ? { ...inv, units: remainingUnits } : inv
        );
        updatedInvestmentsList.push(terminatedPortion);
    }
    setAppData(prev => ({ ...prev, investments: updatedInvestmentsList }));
    setIsWithdrawModalOpen(false); setWithdrawingInvestment(null);
    showToast('Withdrawal processed.', 'success');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      <div className="flex-grow container mx-auto p-4 sm:p-6 max-w-6xl">
        <AppHeader
          currentView={currentView}
          onSetCurrentView={setCurrentView}
          isAzureOperationLoading={isAzureOperationLoading}
        />
        {activeToast && <Toast key={activeToast.id} {...activeToast} onClose={closeToast} />}
        {(isAzureOperationLoading || (isFetchingRate && isInitialDataLoading && usdToAudRate === null)) && ( 
          <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[200]">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl flex items-center space-x-3">
              <svg className="animate-spin h-5 w-5 text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="text-gray-200">{isAzureOperationLoading ? "Processing Server op..." : "Fetching initial rate..."}</span>
            </div>
          </div>
        )}
        {isInitialDataLoading && !isAzureOperationLoading ? ( 
          <div className="text-center py-10"><p className="text-lg text-gray-400">Loading application data...</p></div>
        ) : currentView === 'investments' ? (
          <>
            <SummaryDisplay 
              summaryStats={summaryStats} 
              categorizedSummaryStats={categorizedSummaryStats}
              cachedApiData={appData.cachedApiData} 
              formatCurrency={formatCurrency} 
              formatPercentage={formatPercentage} 
              formatDateTime={formatDateTime}
              formatUnitsForSummary={formatUnitsForSummary}
            />
            <InvestmentControls autoRefreshConfig={autoRefreshConfig} onToggleAutoRefresh={handleToggleAutoRefresh} onManualRefresh={handleManualRefresh} showTerminatedInvestments={showTerminatedInvestments} onToggleShowTerminated={handleToggleShowTerminated} selectedFinancialYear={selectedFinancialYear} financialYearOptions={financialYearOptions} onSetSelectedFinancialYear={setSelectedFinancialYear} onOpenFormForNew={() => openFormForNew()} onExportToCSV={handleExportToCSV} />
            <InvestmentList
              investments={filteredInvestmentsForList}
              managedAssets={sortedManagedAssetsForList}
              currentlyFetchingAssetApiIds={currentlyFetchingAssetApiIds}
              onEdit={handleEditInvestment}
              onDelete={handleDeleteInvestment}
              onWithdraw={handleOpenWithdrawModal}
              formatCurrency={formatCurrency} formatPercentage={formatPercentage} formatDateTime={formatDateTime}
              collapsedAssetGroups={collapsedAssetGroups}
              onToggleAssetGroupCollapse={handleToggleAssetGroupCollapse}
              assetGroupSortConfig={assetGroupSortConfig}
              onChangeSortConfig={handleChangeSortConfig}
              selectedFinancialYear={selectedFinancialYear} 
              onAddNewInvestmentForAsset={handleAddNewInvestmentForAsset}
              onToggleFlagInvestment={handleToggleFlagInvestment}
              individualInvestmentCollapseStates={individualInvestmentCollapseStates}
              onToggleInvestmentCollapse={handleToggleInvestmentCollapse}
            />
            <Modal isOpen={isFormOpen} onClose={() => { setIsFormOpen(false); setDefaultPreselectedAssetId(undefined); }} title={editingInvestment ? 'Edit Investment' : 'Add New Investment'}>
              <InvestmentForm 
                onSubmit={handleSubmitForm} 
                onClose={() => { setIsFormOpen(false); setDefaultPreselectedAssetId(undefined); }} 
                initialData={editingInvestment} 
                managedAssets={managedAssets} 
                getCurrentDateTimeLocalString={getCurrentDateTimeLocalString} 
                defaultPreselectedAssetId={defaultPreselectedAssetId}
                assetCurrentPricesAUD={assetCurrentPricesAUD}
                usdToAudRate={usdToAudRate}
              />
            </Modal>
            <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Withdraw from Investment">
            {withdrawingInvestment && <WithdrawForm 
                investment={withdrawingInvestment} 
                managedAsset={managedAssets.find(ma => ma.id === withdrawingInvestment.assetId)} 
                currentMarketPrice={assetCurrentPricesAUD[withdrawingInvestment.assetId] ?? withdrawingInvestment.currentPricePerUnitAUD}
                onSubmit={handleConfirmWithdraw} 
                onClose={() => setIsWithdrawModalOpen(false)} 
                getCurrentDateTimeLocalString={getCurrentDateTimeLocalString} 
            />}
            </Modal>
          </>
        ) : (
          <SettingsView 
            managedAssets={managedAssets} investments={investments} 
            onAddAsset={handleAddManagedAsset} onDeleteAsset={handleDeleteManagedAsset}
            editingAssetData={editingAssetCurrentData} onEditAssetRequest={handleEditManagedAsset}
            onUpdateAsset={handleUpdateManagedAsset} onCancelEdit={handleCancelEditManagedAsset}
            onExportData={handleExportData} importFileRef={importFileRef} onImportData={handleImportData}
            onRestoreFromServer={handleRestoreFromServer} onBackupToServer={handleBackupToServer}
            isAzureOperationLoading={isAzureOperationLoading}
          />
        )}
      </div>
      <AppFooter />
    </div>
  );
};

export default App;
