
import React, { useState, useEffect, useMemo } from 'react'; // Added useMemo
import { ManagedAsset, InvestmentType, Investment } from '../types'; 

interface SettingsViewProps { // Renamed from AdminViewProps
  managedAssets: ManagedAsset[];
  investments: Investment[]; 
  onAddAsset: (asset: Omit<ManagedAsset, 'id'>) => void;
  onDeleteAsset: (id: string) => void;
  editingAssetData: ManagedAsset | null;
  onEditAssetRequest: (id: string) => void;
  onUpdateAsset: (id: string, assetData: Omit<ManagedAsset, 'id'>) => void;
  onCancelEdit: () => void;
  onExportData: () => void;
  importFileRef: React.RefObject<HTMLInputElement | null> ;
  onImportData: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRestoreFromServer: () => void;
  onBackupToServer: () => void;
  isAzureOperationLoading: boolean;
}

const SettingsView: React.FC<SettingsViewProps> = ({ // Renamed from AdminView
  managedAssets,
  investments, 
  onAddAsset,
  onDeleteAsset,
  editingAssetData,
  onEditAssetRequest,
  onUpdateAsset,
  onCancelEdit,
  onExportData,
  importFileRef,
  onImportData,
  onRestoreFromServer,
  onBackupToServer,
  isAzureOperationLoading
}) => {
  const initialFormState = {
    userGivenName: '',
    apiId: '',
    type: InvestmentType.CRYPTO,
  };
  const [formData, setFormData] = useState<{ userGivenName: string; apiId: string; type: InvestmentType }>(initialFormState);
  const [error, setError] = useState<string | null>(null);
  const [isAssetFormVisible, setIsAssetFormVisible] = useState<boolean>(false); 

  useEffect(() => {
    if (editingAssetData) {
      setFormData({
        userGivenName: editingAssetData.userGivenName,
        apiId: editingAssetData.apiId,
        type: editingAssetData.type,
      });
      setError(null);
      setIsAssetFormVisible(true); 
    }
  }, [editingAssetData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as InvestmentType })); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userGivenName.trim() || !formData.apiId.trim()) {
      setError('User Given Name and API ID cannot be empty.');
      return;
    }
    if (/\s/.test(formData.apiId)) {
      setError('API ID should not contain spaces.');
      return;
    }
    setError(null);

    if (editingAssetData) {
      onUpdateAsset(editingAssetData.id, formData);
    } else {
      onAddAsset(formData);
    }
    setIsAssetFormVisible(false); 
    onCancelEdit(); 
    setFormData(initialFormState); 
  };

  const handleCancelForm = () => { 
    onCancelEdit(); 
    setFormData(initialFormState); 
    setError(null);
    setIsAssetFormVisible(false);
  };

  const handleOpenNewAssetForm = () => { 
    onCancelEdit(); 
    setFormData(initialFormState); 
    setError(null);
    setIsAssetFormVisible(true);
  };

  // Req 5.2: Sort assets alphabetically for display
  const sortedManagedAssets = useMemo(() => 
    [...managedAssets].sort((a, b) => a.userGivenName.localeCompare(b.userGivenName)),
  [managedAssets]);

  const renderAssetList = (assets: ManagedAsset[], title: string) => (
    <div>
      <h3 className="text-xl font-semibold text-primary-400 mb-4">{title}</h3>
      {assets.length === 0 ? <p className="text-gray-400">No {title.toLowerCase()} managed yet.</p> : (
        <ul className="space-y-3">
          {assets.map(asset => {
            const isAssetInUse = investments.some(inv => inv.assetId === asset.id); 
            return (
              <li key={asset.id} className="bg-gray-800 p-4 rounded-md shadow flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-200">{asset.userGivenName}</span>
                  <span className="text-sm text-gray-400 ml-2">({asset.apiId} - {asset.type})</span>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => onEditAssetRequest(asset.id)} 
                    aria-label={`Edit ${asset.userGivenName}`}
                    className="px-3 py-1 text-xs font-medium text-yellow-300 bg-yellow-700 hover:bg-yellow-600 rounded-md shadow-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDeleteAsset(asset.id)}
                    aria-label={`Delete ${asset.userGivenName}`}
                    className="px-3 py-1 text-xs font-medium text-red-300 bg-red-700 hover:bg-red-600 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isAssetInUse} 
                    title={isAssetInUse ? "Asset is in use by investments. Delete investments first." : `Delete ${asset.userGivenName}`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const cryptoAssets = sortedManagedAssets.filter(asset => asset.type === InvestmentType.CRYPTO);
  const equityAssets = sortedManagedAssets.filter(asset => asset.type === InvestmentType.EQUITY);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-primary-300 mb-2">Application Settings</h2> {/* Req 6: Title changed */}
        <p className="text-sm text-gray-400 mb-6">Manage assets and application data. Data is primarily stored in your browser.</p>

        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-8">
            <h3 className="text-lg font-medium text-gray-200 border-b border-gray-700 pb-2 mb-4">Data Management</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                <button
                    onClick={onRestoreFromServer}
                    disabled={isAzureOperationLoading}
                    className="px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Overwrite local data with data from server"
                >
                    Restore
                </button>
                <button
                    onClick={onBackupToServer}
                    disabled={isAzureOperationLoading}
                    className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save current local data to server (overwrites main, creates backup)"
                >
                    Backup
                </button>
                <button
                    onClick={onExportData}
                    disabled={isAzureOperationLoading}
                    className="px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md disabled:opacity-50"
                >
                    Export JSON
                </button>
                <input type="file" accept=".json" onChange={onImportData} className="hidden" id="settings-import-file-input" ref={importFileRef} />
                <button
                    onClick={() => document.getElementById('settings-import-file-input')?.click()}
                    disabled={isAzureOperationLoading}
                    className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-md disabled:opacity-50"
                >
                    Import JSON
                </button>
            </div>
        </div>

        {!isAssetFormVisible && (
            <div className="mb-8">
                 <button
                    onClick={handleOpenNewAssetForm}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
                >
                    + Add New Asset
                </button>
            </div>
        )}

        {isAssetFormVisible && (
            <form onSubmit={handleSubmit} className="bg-gray-800 p-6 rounded-lg shadow-md space-y-4 mb-8">
            <h3 className="text-lg font-medium text-gray-200 border-b border-gray-700 pb-2 mb-4">{editingAssetData ? 'Edit Asset' : 'Add New Asset'}</h3>
            {error && <p className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-2 rounded">{error}</p>}
            <div>
                <label htmlFor="userGivenName" className="block text-sm font-medium text-gray-300">User Given Name</label>
                <input
                type="text"
                name="userGivenName"
                id="userGivenName"
                value={formData.userGivenName}
                onChange={handleChange}
                required
                placeholder="e.g., Bitcoin, Tesla Inc."
                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
            </div>
            <div>
                <label htmlFor="apiId" className="block text-sm font-medium text-gray-300">API ID</label>
                <input
                type="text"
                name="apiId"
                id="apiId"
                value={formData.apiId}
                onChange={handleChange}
                required
                placeholder="e.g., bitcoin (CoinGecko), TSLA (Equity Ticker)"
                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">For crypto, use CoinGecko ID. For equities, use ticker symbol. Changes may affect existing investments.</p>
            </div>
            <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-300">Type</label>
                <select
                name="type"
                id="type"
                value={formData.type}
                onChange={handleChange}
                className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                {Object.values(InvestmentType).map(type => (
                    <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>
                ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Changes may affect existing investments.</p>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
                <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md shadow-sm"
                >
                    Cancel
                </button>
                <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm"
                >
                {editingAssetData ? 'Update Asset' : 'Add Asset'}
                </button>
            </div>
            </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {renderAssetList(cryptoAssets, "Cryptocurrencies")}
        {renderAssetList(equityAssets, "Equities / Stocks")}
      </div>
    </div>
  );
};

export default SettingsView; // Renamed component
