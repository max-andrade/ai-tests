
export enum InvestmentType {
  CRYPTO = 'CRYPTO',
  EQUITY = 'EQUITY',
}

export interface ManagedAsset {
  id: string; // Unique internal ID, e.g., crypto.randomUUID()
  userGivenName: string; // User-friendly name, e.g., "Bitcoin", "Tesla Stock"
  apiId: string; // ID used for API calls, e.g., "bitcoin" for CoinGecko, "TSLA" for TwelveData
  type: InvestmentType;
}

export interface Investment {
  id: string; // Unique ID for the investment entry
  assetId: string; // Refers to ManagedAsset.id
  type: InvestmentType;
  units: number; // Amount of crypto or number of shares
  priceOnInvestmentAUD: number; // Price per unit/share at the start of theinvestment (ALWAYS AUD)
  currentPricePerUnitAUD: number; // Current market price per unit/share, or price at termination if ended
  startDate: string; // ISO 8601 format: YYYY-MM-DDTHH:mm
  endDate?: string | null; // ISO 8601 format: YYYY-MM-DDTHH:mm, optional or null if active
  isFlagged?: boolean; // Req 1: For flagging an investment
  notes?: string; // Req 2: Optional notes for an investment
}

export interface InvestmentFormData {
  assetId: string;
  type: InvestmentType; 
  units: number;
  startDate: string; // UTC ISO
  endDate?: string | null; // UTC ISO
  notes?: string; // Req 2
}

export type InvestmentFormSubmitData = InvestmentFormData & {
    priceInputValue: number;
    priceInputCurrency: 'AUD' | 'USD';
};


export interface CryptoPriceResponse {
  [key: string]: {
    aud: number;
  };
}

export interface EquityPriceDetail {
  price: string;
}

export type EquityPriceMap = {
  [key: string]: EquityPriceDetail;
};

export type EquitySingleSymbolResponse = {
  symbol: EquityPriceDetail;
  [key: string]: any;
};

export interface EquityErrorResponse {
  code: number;
  message: string;
  status?: string;
}

export type EquityPriceResponse = EquityPriceMap | EquitySingleSymbolResponse | EquityErrorResponse;

export enum StorageType {
  LOCAL = 'local',
}

// User Preferences Interface
export interface UserPreferences {
  collapsedAssetGroups: Record<string, boolean>;
  assetGroupSortConfig: AssetGroupSortConfig;
  showTerminatedInvestments: boolean;
  autoRefreshConfig: AutoRefreshConfig;
  selectedFinancialYear: FinancialYear;
  individualInvestmentCollapseStates: Record<string, boolean>;
}

// New interfaces for API data caching
export interface SyncTimestamps {
  crypto?: string; // ISO string
  equities?: string; // ISO string
  exchangeRate?: string; // ISO string
}

export interface CachedApiData {
  cryptoPricesAUD?: Record<string, number>; // Keyed by ManagedAsset.apiId
  equityPricesUSD?: Record<string, number>; // Keyed by ManagedAsset.apiId, stores USD price
  exchangeRate?: number | null;
  syncTimestamps?: SyncTimestamps;
}

export interface AppData {
  investments: Investment[];
  managedAssets: ManagedAsset[];
  preferences?: UserPreferences;
  cachedApiData?: CachedApiData; // For storing last fetched API results and timestamps
}

export type AssetGroupSortKey = 'assetName' | 'latestInvestmentDate' | 'oldestInvestmentDate' | 'totalInvestedValue';
export type SortDirection = 'asc' | 'desc';

export interface AssetGroupSortConfig {
  key: AssetGroupSortKey;
  direction: SortDirection;
}

export interface WithdrawFormData {
  unitsToWithdraw: number;
  withdrawalDateTime: string;
  priceAtWithdrawal: number;
}

export interface AutoRefreshConfig {
  enabled: boolean;
}

export const ALL_TIME_FY = "ALL_TIME";
export type FinancialYear = typeof ALL_TIME_FY | string;

export interface ToastConfig {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
  duration?: number;
}

export type AppView = 'investments' | 'settings';

export const LOCAL_STORAGE_KEYS = {
  APP_DATA: 'investmentTrackerData_v4', // Incremented version
  COLLAPSED_ASSET_GROUPS: 'investmentGroupCollapsedStates_v2', 
  ASSET_GROUP_SORT_CONFIG: 'investmentGroupSortOrder_v1', 
  SHOW_TERMINATED_INVESTMENTS: 'investmentShowTerminated_v1',
  AUTO_REFRESH_CONFIG: 'investmentAutoRefresh_v1', 
  SELECTED_FINANCIAL_YEAR: 'investmentFinancialYear_v1',
  INVESTMENT_COLLAPSE_STATES: 'investmentItemCollapseStates_v1',
};

export interface ExchangeRateApiResponse {
  result: string;
  provider: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  time_eol_unix: number;
  base_code: string;
  rates: {
    [currencyCode: string]: number;
  };
}


export interface SummaryStatsData {
  investmentValue: number;      
  portfolioValue: number;       
  portfolioPandL: number;       
  portfolioPandLPercentage: number;
  realisedPandLAllTime: number; 
  totalUnits?: number; // Optional: For displaying total units in categorized summaries
  assetType?: InvestmentType; // Optional: For helping format units in categorized summaries
}

export interface CategorizedSummaryStats {
  bitcoin: SummaryStatsData;
  altcoins: SummaryStatsData; // Excluding Bitcoin
  equities: SummaryStatsData;
}

export interface InvestmentFormPropsInternal {
  onSubmit: (data: InvestmentFormSubmitData, id?: string) => void;
  onClose: () => void;
  initialData?: Investment | null;
  managedAssets: ManagedAsset[];
  getCurrentDateTimeLocalString: () => string;
  defaultPreselectedAssetId?: string; 
  assetCurrentPricesAUD?: Record<string, number | null>;
  usdToAudRate: number | null;
}

export interface SummaryDisplayPropsInternal {
  summaryStats: SummaryStatsData;
  categorizedSummaryStats?: CategorizedSummaryStats;
  cachedApiData?: CachedApiData; 
  formatCurrency: (amount: number) => string;
  formatPercentage: (value: number) => string;
  formatDateTime: (isoString?: string | null) => string;
  formatUnitsForSummary?: (units: number, type?: InvestmentType) => string;
}
