
import { CryptoPriceResponse, EquityPriceResponse, EquityErrorResponse } from '../types';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3/simple/price';
const TWELVEDATA_API_BASE = 'https://api.twelvedata.com';
const TWELVEDATA_API_KEY = '9778d9520fca4c86836407d3d52969f7'; // As provided

/**
 * Fetches current prices for given cryptocurrency IDs from CoinGecko.
 * @param tokenIds Array of CoinGecko token IDs (e.g., ['bitcoin', 'ethereum'])
 * @returns Promise<CryptoPriceResponse>
 */
export const fetchCryptoPrices = async (tokenIds: string[]): Promise<CryptoPriceResponse> => {
  if (tokenIds.length === 0) return Promise.resolve({});
  const idsParam = tokenIds.join(',');
  const url = `${COINGECKO_API_BASE}?ids=${idsParam}&vs_currencies=aud`;

  try {
    console.log(url);
    // Simplified fetch call, removing explicit headers and mode
    const response = await fetch(url);

    if (!response.ok) {
      const errorStatusText = response.statusText || 'Unknown API error';
      let errorBody = errorStatusText;
      try {
        errorBody = await response.text();
      } catch (e) { /* ignore if reading body fails */ }
      console.error(`CoinGecko API error: ${response.status} ${errorStatusText}. Body: ${errorBody}`);
      throw new Error(`Failed to fetch crypto prices: ${errorStatusText}`);
    }
    const data: CryptoPriceResponse = await response.json();
    console.log('CoinGecko API Response:', data);
    return data;
  } catch (error) {
    console.error('Error in fetchCryptoPrices:', error);
    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
        console.error('This "Failed to fetch" error (CoinGecko) often indicates a network issue, CORS policy violation, an invalid API endpoint, or browser extensions interfering.');
    }
    throw error; // Re-throw to be caught by caller
  }
};

/**
 * Fetches current prices for given equity symbols from Twelve Data.
 * @param symbols Array of stock ticker symbols (e.g., ['AAPL', 'TSLA'])
 * @returns Promise<EquityPriceResponse>
 */
export const fetchEquityPrices = async (symbols: string[]): Promise<EquityPriceResponse> => {
  if (symbols.length === 0) return Promise.resolve({});
  const symbolsParam = symbols.join(',');
  // Using `source=docs` as `conversion=AUD` is problematic with the demo key on /price.
  // This means prices will likely be in USD or the stock's native currency.
  const url = `${TWELVEDATA_API_BASE}/price?symbol=${symbolsParam}&apikey=${TWELVEDATA_API_KEY}`;
console.log(url);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      mode: 'cors', // Explicitly set mode for cross-origin requests
    });

    if (!response.ok) { // Handles HTTP errors like 401, 403, 500 etc.
      const errorStatusText = response.statusText || 'Unknown API error';
      let errorPayload: any = { message: errorStatusText }; // Default error payload
      try {
        errorPayload = await response.json(); // TwelveData usually returns JSON errors
      } catch (e) {
        // If parsing JSON fails, try to get text
        try {
            errorPayload.message = await response.text() || errorStatusText;
        } catch (textErr) { /* ignore */ }
      }
      console.error(`Twelve Data API HTTP error: ${response.status} ${errorStatusText}. Payload:`, JSON.stringify(errorPayload));
      throw new Error(`Failed to fetch equity prices: ${errorPayload.message || errorStatusText}`);
    }
    
    const data: EquityPriceResponse = await response.json();
    console.log('Twelve Data API Response:', data);
    
    // Handle cases where API returns an error structure within a 200 OK response (e.g. specific API error codes)
    if ('code' in data && typeof data.code === 'number' && data.code !== 200 && 'message' in data) {
        const errorResponse = data as EquityErrorResponse;
        console.error(`Twelve Data API functional error (status ${errorResponse.code}): ${errorResponse.message}`);
        throw new Error(`Failed to fetch equity prices (API error): ${errorResponse.message}`);
    }
    return data;
  } catch (error) {
    console.error('Error in fetchEquityPrices:', error);
     if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
        console.error('This "Failed to fetch" error (TwelveData) often indicates a network issue, CORS policy violation, an invalid API endpoint, or browser extensions interfering.');
    }
    throw error; // Re-throw
  }
};
