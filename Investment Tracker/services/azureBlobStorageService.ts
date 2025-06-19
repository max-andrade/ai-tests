
import { AZURE_STORAGE_CONFIG } from '../config';
import { AppData } from "../types";

// Helper function for timeout - kept from previous version
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutError = new Error('Promise timed out')): Promise<T> {
  let timer: number | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = window.setTimeout(() => {
        console.warn(`A promise operation timed out after ${ms / 1000}s: ${timeoutError.message}`);
        reject(timeoutError);
    }, ms);
  });
  
  return Promise.race([
      promise.finally(() => { 
        if (timer !== undefined) clearTimeout(timer);
      }),
      timeoutPromise
    ])
    .finally(() => { 
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    });
}

const AZURE_DOWNLOAD_TIMEOUT_MS = 20000;
const AZURE_UPLOAD_TIMEOUT_MS = 25000; // Can involve multiple requests (backup put, main put)
const AZURE_API_VERSION = '2023-11-03'; // Specify a recent, fixed API version

export const downloadDataFromAzure = async (): Promise<AppData | null> => {
  const baseBlobUrl = `${AZURE_STORAGE_CONFIG.containerUrl}/${AZURE_STORAGE_CONFIG.fileName}?${AZURE_STORAGE_CONFIG.sasToken}`;
  const blobUrlWithCacheBust = `${baseBlobUrl}&v_dl=${Date.now()}`;
  console.log(`Azure (fetch): Attempting to download data from ${blobUrlWithCacheBust}`);

  const operation = async () => {
    const response = await fetch(blobUrlWithCacheBust, {
      method: 'GET',
      headers: {
        'x-ms-version': AZURE_API_VERSION,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    if (response.status === 404) {
      console.log("Azure (fetch): No data file found (404).");
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP error ${response.status} with unreadable body`);
      console.error(`Azure (fetch): Failed to download data. Status: ${response.status}. Response: ${errorText}`);
      throw new Error(`Azure (fetch): HTTP error ${response.status}. ${errorText}`);
    }
    
    const responseText = await response.text();
    if (!responseText || responseText.trim() === "") {
        console.log("Azure (fetch): Downloaded data is empty or whitespace.");
        return null;
    }

    try {
        const data = JSON.parse(responseText) as AppData;
        console.log("Azure (fetch): Data successfully downloaded and parsed.");
        if (!data || typeof data.investments === 'undefined' || typeof data.managedAssets === 'undefined') {
          console.warn("Azure (fetch): Parsed data does not conform to AppData structure.", data);
          throw new Error("Parsed data is not valid AppData.");
        }
        return data;
    } catch (e: any) {
        console.error("Azure (fetch): Failed to parse JSON response:", e.message, "Raw text snippet:", responseText.substring(0, 100));
        throw new Error(`Azure (fetch): Failed to parse JSON data. ${e.message}`);
    }
  };

  try {
    return await promiseWithTimeout(operation(), AZURE_DOWNLOAD_TIMEOUT_MS, new Error('Azure (fetch) download operation timed out'));
  } catch (error: any) {
    // Log the detailed error message from the operation or the timeout error.
    console.error("Azure (fetch): Download failed:", error.message);
    return null; // Ensure null is returned on any failure from this service function.
  }
};

export const uploadDataToAzure = async (data: AppData): Promise<void> => {
  const mainBlobName = AZURE_STORAGE_CONFIG.fileName;
  const baseMainBlobUrl = `${AZURE_STORAGE_CONFIG.containerUrl}/${mainBlobName}?${AZURE_STORAGE_CONFIG.sasToken}`;
  const dataString = JSON.stringify(data, null, 2);

  // --- Main Upload Step ---
  console.log(`Azure (fetch): Attempting to upload data to main file: ${mainBlobName}`);
  const mainUploadOperation = async () => {
    const response = await fetch(baseMainBlobUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json',
        'x-ms-version': AZURE_API_VERSION,
      },
      body: dataString,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `Main upload HTTP error ${response.status}`);
      console.error(`Azure (fetch): Failed to upload main data. Status: ${response.status}. Response: ${errorText}`);
      throw new Error(`Azure (fetch) main upload HTTP error ${response.status}. ${errorText}`);
    }
    console.log(`Azure (fetch): Data uploaded to Azure: ${mainBlobName}`);
  };

  try {
    await promiseWithTimeout(mainUploadOperation(), AZURE_UPLOAD_TIMEOUT_MS / 2, new Error('Azure (fetch) main upload operation timed out'));
  } catch (uploadError: any) {
    console.error("Azure (fetch): Main upload failed:", uploadError.message);
    throw uploadError; // Re-throw to be caught by caller in App.tsx
  }

  // --- Timestamped Backup Upload Step ---
  try {
    const backupBlobName = `${mainBlobName.replace('.json', '')}_${new Date().toISOString().replace(/:/g, '-')}.json`;
    const backupUrl = `${AZURE_STORAGE_CONFIG.containerUrl}/${backupBlobName}?${AZURE_STORAGE_CONFIG.sasToken}`;
    console.log(`Azure (fetch): Attempting to create timestamped backup: ${backupBlobName}`);

    const backupUploadOperation = async () => {
      const backupResponse = await fetch(backupUrl, {
          method: 'PUT',
          headers: {
              'x-ms-blob-type': 'BlockBlob',
              'Content-Type': 'application/json',
              'x-ms-version': AZURE_API_VERSION,
          },
          body: dataString, // Use the same dataString
      });
      if (!backupResponse.ok) {
          const errorText = await backupResponse.text().catch(() => `Timestamped backup upload HTTP error ${backupResponse.status}`);
          throw new Error(`Azure (fetch) timestamped backup upload HTTP error ${backupResponse.status}. ${errorText}`);
      }
      console.log(`Azure (fetch): Timestamped backup created: ${backupBlobName}`);
    };
    // Give this its own timeout budget
    await promiseWithTimeout(backupUploadOperation(), AZURE_UPLOAD_TIMEOUT_MS / 2, new Error('Azure (fetch) timestamped backup upload operation timed out'));
  } catch (backupError: any) {
    console.error("Azure (fetch): Failed to create timestamped backup.", backupError.message);
    // Depending on requirements, you might want to inform the user that the primary save succeeded but backup failed.
    // For now, we'll let the error propagate if the main upload succeeded but this failed.
    // Or, one could throw a custom error indicating partial success.
    throw new Error(`Main data saved, but timestamped backup failed: ${backupError.message}`);
  }
};