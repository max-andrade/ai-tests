import { CryptoPriceResponse, EquityPriceResponse } from '../types';

const CONSOLIDATED_API_URL = 'https://ma-apim.azure-api.net/investment-tracker/consolidated-prices';

/**
 * Fetches consolidated prices (crypto, equity, exchange rate) from custom API.
 * @param cryptoTokens Array of CoinGecko token IDs (e.g., ['bitcoin', 'ethereum'])
 * @param equitySymbols Array of stock ticker symbols (e.g., ['AAPL', 'TSLA'])
 * @returns Promise<{ cryptoPricesAUD: CryptoPriceResponse, equityPricesUSD: EquityPriceResponse, usdToAudRate: number | null }>
 */
export const fetchConsolidatedPrices = async (
  cryptoTokens: string[],
  equitySymbols: string[]
): Promise<{ cryptoPricesAUD: CryptoPriceResponse, equityPricesUSD: EquityPriceResponse, usdToAudRate: number | null }> => {
  const params = new URLSearchParams();
  if (cryptoTokens.length > 0) params.append('crypto', cryptoTokens.join(','));
  if (equitySymbols.length > 0) params.append('equities', equitySymbols.join(','));
  const url = `${CONSOLIDATED_API_URL}?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP error ${response.status}`);
      throw new Error(`Failed to fetch consolidated prices: ${errorText}`);
    }
    const data = await response.json();
    return {
      cryptoPricesAUD: data.cryptoPricesAUD || {},
      equityPricesUSD: data.equityPricesUSD || {},
      usdToAudRate: typeof data.usdToAudRate === 'number' ? data.usdToAudRate : null
    };
  } catch (error) {
    console.error('Error in fetchConsolidatedPrices:', error);
    throw error;
  }
};
