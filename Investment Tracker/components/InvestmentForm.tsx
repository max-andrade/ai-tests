
import React, { useState, useEffect, useMemo } from 'react';
import { Investment, InvestmentType, ManagedAsset, InvestmentFormSubmitData, InvestmentFormPropsInternal } from '../types';
import {
    convertLocalToUTCISO,
    convertUTCIsoToLocalDateTimeString
} from '../dateUtils';


const InvestmentForm: React.FC<InvestmentFormPropsInternal> = ({
    onSubmit,
    onClose,
    initialData,
    managedAssets,
    getCurrentDateTimeLocalString,
    defaultPreselectedAssetId,
    assetCurrentPricesAUD, // Req 3
    usdToAudRate // Req 3 (needed if fallback to USD for equity price entry)
}) => {
  const [assetId, setAssetId] = useState<string>('');
  const [units, setUnits] = useState<number>(0);
  const [priceInputValue, setPriceInputValue] = useState<number>(0);
  const [priceInputCurrency, setPriceInputCurrency] = useState<'AUD' | 'USD'>('USD'); 
  const [startDateLocal, setStartDateLocal] = useState<string>(getCurrentDateTimeLocalString());
  const [endDateLocal, setEndDateLocal] = useState<string>('');
  const [derivedType, setDerivedType] = useState<InvestmentType>(InvestmentType.CRYPTO);
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isFetchingDefaultPrice, setIsFetchingDefaultPrice] = useState<boolean>(false); // Not directly used for API call here, but for UI indication if needed

  const sortedManagedAssets = useMemo(() => {
    return [...managedAssets].sort((a, b) => a.userGivenName.localeCompare(b.userGivenName));
  }, [managedAssets]);

  // Effect for handling initialData (editing existing investment)
  useEffect(() => {
    if (initialData) { 
      setAssetId(initialData.assetId);
      setUnits(initialData.units);
      setPriceInputValue(initialData.priceOnInvestmentAUD);
      setPriceInputCurrency('AUD'); 
      setStartDateLocal(convertUTCIsoToLocalDateTimeString(initialData.startDate));
      setEndDateLocal(initialData.endDate ? convertUTCIsoToLocalDateTimeString(initialData.endDate) : '');
      setNotes(initialData.notes || '');
      const assetForType = managedAssets.find(a => a.id === initialData.assetId);
      setDerivedType(assetForType?.type || initialData.type);
    }
  }, [initialData, managedAssets, getCurrentDateTimeLocalString]);


  // Effect for NEW investments: setting asset type, and default price (Req 3)
  useEffect(() => {
    if (initialData) return; // Only for new investments

    const preselectedId = defaultPreselectedAssetId || assetId;

    if (preselectedId) {
        const selectedAsset = managedAssets.find(a => a.id === preselectedId);
        if (selectedAsset) {
            setDerivedType(selectedAsset.type);
            
            // Req 3: Set default price from assetCurrentPricesAUD
            if (assetCurrentPricesAUD && assetCurrentPricesAUD[preselectedId] !== undefined && assetCurrentPricesAUD[preselectedId] !== null) {
                const audPrice = assetCurrentPricesAUD[preselectedId]!;
                setPriceInputValue(parseFloat(audPrice.toFixed(2)));
                setPriceInputCurrency('AUD');
            } else {
                // Fallback if live price is not available
                setPriceInputValue(0);
                setPriceInputCurrency(selectedAsset.type === InvestmentType.CRYPTO ? 'AUD' : 'USD');
            }
        } else { // Asset not found (should be rare if IDs are consistent)
            setPriceInputValue(0);
            setPriceInputCurrency('USD');
            setDerivedType(InvestmentType.CRYPTO);
        }
    } else { // No asset selected yet for a new form
        setAssetId(''); // Ensure assetId is cleared if defaultPreselectedAssetId was cleared
        setUnits(0);
        setPriceInputValue(0);
        setPriceInputCurrency('USD'); // General default
        setDerivedType(InvestmentType.CRYPTO); // General default
        setStartDateLocal(getCurrentDateTimeLocalString());
        setEndDateLocal('');
        setNotes('');
    }
  }, [
      initialData, 
      assetId, // When user selects an asset in the form
      defaultPreselectedAssetId, // When form opens with a preselected asset
      managedAssets, 
      assetCurrentPricesAUD, // When live prices update
      getCurrentDateTimeLocalString 
    ]);
  
  // Effect for setting assetId from defaultPreselectedAssetId on form open (for new investment)
  useEffect(() => {
    if (!initialData && defaultPreselectedAssetId) {
        setAssetId(defaultPreselectedAssetId);
        // The main effect above will handle price defaulting once assetId is set.
    } else if (!initialData && !defaultPreselectedAssetId) {
        // If default is removed or was never there, clear assetId IF it's not user-selected.
        // This needs careful handling if user can clear a preselection.
        // For now, if assetId is already set by user choice, this does nothing.
        // If assetId is empty, it remains empty until user selection.
    }
  }, [initialData, defaultPreselectedAssetId]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setError(null);

    if (name === 'assetId') {
        setAssetId(value);
        // The useEffect for assetId changes will handle derivedType and default price for new forms.
        // For existing forms (initialData present), type and price are already set.
    }
    else if (name === 'units') setUnits(parseFloat(value) || 0);
    else if (name === 'priceInputValue') setPriceInputValue(parseFloat(value) || 0);
    else if (name === 'priceInputCurrency') setPriceInputCurrency(value as 'AUD' | 'USD');
    else if (name === 'startDateLocal') setStartDateLocal(value);
    else if (name === 'endDateLocal') setEndDateLocal(value);
    else if (name === 'notes') setNotes(value);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    if (name === 'isTerminated') {
      setEndDateLocal(checked ? getCurrentDateTimeLocalString() : '');
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!assetId) {
      setError("Please select an asset."); 
      return;
    }
    const selectedAsset = managedAssets.find(a => a.id === assetId); // Get selected asset for type
    if (!selectedAsset) {
        setError("Selected asset definition not found. Critical error.");
        return;
    }

    if (units <= 0) {
      setError("Units must be greater than zero.");
      return;
    }
    if (priceInputValue < 0) { 
      setError("Price on investment cannot be negative.");
      return;
    }
    if (priceInputCurrency === 'USD' && !usdToAudRate && priceInputValue > 0) {
        setError("USD/AUD exchange rate is not available. Cannot save with USD price. Please select AUD or try refreshing rates.");
        return;
    }
    if (!startDateLocal) {
        setError("Start date is required.");
        return;
    }

    const utcStartDate = convertLocalToUTCISO(startDateLocal);
    if (!utcStartDate) {
        setError("Invalid Start Date. Please ensure it is a valid date and time.");
        return;
    }

    let utcEndDate: string | null = null;
    if (endDateLocal) {
      utcEndDate = convertLocalToUTCISO(endDateLocal);
      if (!utcEndDate) {
        setError("Invalid End Date. Please ensure it is a valid date and time.");
        return;
      }
      if (new Date(utcEndDate).getTime() < new Date(utcStartDate).getTime()) {
        setError("End date cannot be before the start date.");
        return;
      }
    }
    
    const investmentToSubmit: InvestmentFormSubmitData = {
      assetId: assetId,
      type: selectedAsset.type, 
      units: units,
      priceInputValue: priceInputValue,
      priceInputCurrency: priceInputCurrency,
      startDate: utcStartDate,
      endDate: utcEndDate,
      notes: notes.trim() || undefined,
    };

    onSubmit(investmentToSubmit, initialData?.id);
  };

  const isTerminatedChecked = !!endDateLocal;
  const currentSelectedAssetForInfo = managedAssets.find(a => a.id === assetId);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-sm">
      {error && <p className="text-red-400 bg-red-900 bg-opacity-30 p-3 rounded-md text-sm">{error}</p>}

      <div>
        <label htmlFor="assetId" className="block text-sm font-medium text-gray-300 mb-1">Asset</label>
        <select
          name="assetId"
          id="assetId"
          value={assetId}
          onChange={handleChange}
          required 
          className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
        >
          <option value="" disabled={assetId !== "" || !!defaultPreselectedAssetId} > 
            Select an Asset...
          </option>
          {sortedManagedAssets.length === 0 && !assetId && <option value="" disabled>No assets managed. Go to Settings.</option>}
          {sortedManagedAssets.map(asset => (
            <option key={asset.id} value={asset.id}>
              {asset.userGivenName} ({asset.apiId} - {asset.type})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="units" className="block text-sm font-medium text-gray-300 mb-1">Units / Shares</label>
          <input
            type="number"
            name="units"
            id="units"
            value={units}
            onChange={handleChange}
            required
            step="any"
            className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
          />
        </div>
        <div className="flex flex-col">
            <label htmlFor="priceInputValue" className="block text-sm font-medium text-gray-300 mb-1">
                {initialData?.endDate ? 'Price at Termination' : (initialData ? 'Original Price' : 'Price on Investment')}
            </label>
            <div className="flex gap-2">
                <input
                    type="number"
                    name="priceInputValue"
                    id="priceInputValue"
                    value={priceInputValue}
                    onChange={handleChange}
                    required
                    step="any"
                    className="w-2/3 bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
                />
                <select
                    name="priceInputCurrency"
                    id="priceInputCurrency"
                    value={priceInputCurrency}
                    onChange={handleChange}
                    className="w-1/3 bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
                    disabled={!!initialData} // Disable currency change when editing
                >
                    <option value="AUD">AUD</option>
                    <option value="USD">USD</option>
                </select>
            </div>
            {priceInputCurrency === 'USD' && !initialData && <p className="text-xs text-gray-400 mt-1">Will be converted to AUD on save.</p>}
            {!initialData && assetCurrentPricesAUD && currentSelectedAssetForInfo && assetCurrentPricesAUD[currentSelectedAssetForInfo.id] === undefined &&
             <p className="text-xs text-yellow-400 mt-1">Live price for this asset isn't available. Manual entry required.</p>
            }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDateLocal" className="block text-sm font-medium text-gray-300 mb-1">Start Date & Time (Local)</label>
          <input
            type="datetime-local"
            name="startDateLocal"
            id="startDateLocal"
            value={startDateLocal}
            onChange={handleChange}
            required
            className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
          />
        </div>
        <div>
            <div className="flex items-center justify-between mb-1 h-6"> 
                <label htmlFor="endDateLocal" className="block text-sm font-medium text-gray-300">
                    End Date & Time (Local)
                </label>
                { !initialData?.endDate && ( 
                     <div className="flex items-center">
                        <input
                            id="isTerminated"
                            name="isTerminated"
                            type="checkbox"
                            checked={isTerminatedChecked}
                            onChange={handleCheckboxChange}
                            className="h-4 w-4 text-primary-600 border-gray-500 rounded bg-gray-700 focus:ring-primary-500 focus:ring-offset-gray-800"
                            aria-describedby="isTerminated-description"
                        />
                        <label htmlFor="isTerminated" className="ml-2 text-xs text-gray-400">
                            {isTerminatedChecked ? 'Selected (Clear to Deactivate)' : 'Terminate Now?'}
                        </label>
                    </div>
                )}
            </div>
            <input
                type="datetime-local"
                name="endDateLocal"
                id="endDateLocal"
                value={endDateLocal}
                onChange={handleChange}
                disabled={!isTerminatedChecked && !initialData?.endDate} 
                className={`w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200 ${(!isTerminatedChecked && !initialData?.endDate) ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            <p id="isTerminated-description" className="text-xs text-gray-500 mt-1">
                Leave blank if investment is active. If terminating, set date & time. 
                The "Price" field above will be used as Price at Termination.
            </p>
        </div>
      </div>
      
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">Notes (Optional)</label>
        <textarea
          name="notes"
          id="notes"
          value={notes}
          onChange={handleChange}
          rows={3}
          placeholder="Any additional details about this investment..."
          className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 hover:bg-gray-500 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-primary-500"
        >
          {initialData ? 'Update Investment' : 'Add Investment'}
        </button>
      </div>
    </form>
  );
};

export default InvestmentForm;
