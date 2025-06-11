
import { ExchangeRateApiResponse } from '../types';

const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';
// CACHE_DURATION_MS and LOCAL_STORAGE_KEYS.USD_AUD_EXCHANGE_RATE are removed.

/**
 * Fetches the USD to AUD exchange rate directly from the API.
 * Caching is now handled by the calling component (App.tsx) within AppData.
 * @returns Promise<number | null> The AUD rate per USD, or null if fetching fails.
 */
export const getUsdToAudRate = async (): Promise<number | null> => {
  console.log("Fetching USD/AUD exchange rate from API...");
  try {
    const response = await fetch(EXCHANGE_RATE_API_URL);
    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP error ${response.status}`);
      console.error(`ExchangeRate API error: ${response.status}. ${errorText}`);
      throw new Error(`Failed to fetch exchange rate: ${errorText}`);
    }

    const data: ExchangeRateApiResponse = await response.json();

    if (data.result === 'success' && data.rates && data.rates.AUD) {
      const audRate = data.rates.AUD;
      console.log("Fetched USD/AUD exchange rate from API:", audRate);
      return audRate;
    } else {
      console.error("ExchangeRate API response error or AUD rate missing:", data);
      throw new Error("Invalid response format from ExchangeRate API or AUD rate not found.");
    }
  } catch (error) {
    console.error("Error in getUsdToAudRate:", error);
    return null;
  }
};
