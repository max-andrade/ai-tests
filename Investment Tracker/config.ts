// Azure Blob Storage Configuration
// IMPORTANT: Ensure the SAS token has the necessary permissions:
// Read, Add, Create, Write, List for the container.
// The SAS token should be for the container level.

export const AZURE_STORAGE_CONFIG = {
  // The base URL of your Azure Blob Storage container.
  // Example: "https://youraccountname.blob.core.windows.net/yourcontainername"
  containerUrl: "https://mamediashare.blob.core.windows.net/investment-tracker",

  // Your SAS token for the container.
  // Example: "sv=2022-11-02&ss=bfqt&srt=sco&sp=rwdlacupx&se=2024-12-31T23:59:59Z&st=2023-01-01T00:00:00Z&spr=https&sig=yourActualSignature"
  sasToken: "sp=racwl&st=2025-06-06T06:17:34Z&se=2099-06-06T14:17:34Z&spr=https&sv=2024-11-04&sr=c&sig=Zf3o58rGnDCu%2BO0SPSnEEW5Mi5jin%2BRtMIGw5%2B7jUJw%3D",
  
  // The name of the blob (file) where the application data will be stored.
  fileName: "investment-tracker-config.json"
};
