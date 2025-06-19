// Azure Blob Storage Configuration
// IMPORTANT: Ensure the SAS token has the necessary permissions:
// Read, Add, Create, Write, List for the container.
// The SAS token should be for the container level.

import secrets from './secrets.json';

export const AZURE_STORAGE_CONFIG = {
  // The base URL of your Azure Blob Storage container.
  // Example: "https://youraccountname.blob.core.windows.net/yourcontainername"
  containerUrl: "https://mamediashare.blob.core.windows.net/investment-tracker",

  // Your SAS token for the container.
  // Example: "sv=2022-11-02&ss=bfqt&srt=sco&sp=rwdlacupx&se=2024-12-31T23:59:59Z&st=2023-01-01T00:00:00Z&spr=https&sig=yourActualSignature"
  sasToken: secrets.sasToken,
  
  // The name of the blob (file) where the application data will be stored.
  fileName: "investment-tracker-config.json"
};
