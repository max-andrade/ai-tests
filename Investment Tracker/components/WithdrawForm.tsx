
import React, { useState, useEffect } from 'react';
import { Investment, ManagedAsset, WithdrawFormData } from '../types';
import { 
    parseDateTimeLocalString, 
    formatToDateTimeLocalString, 
    // getCurrentDateTimeLocalString as getDateTimeStringUtil, // Prop used
    convertLocalToUTCISO
} from '../dateUtils';


interface WithdrawFormProps {
  investment: Investment;
  managedAsset: ManagedAsset | undefined;
  currentMarketPrice: number | undefined;
  onSubmit: (formData: WithdrawFormData) => void;
  onClose: () => void;
  getCurrentDateTimeLocalString: () => string;
}

const WithdrawForm: React.FC<WithdrawFormProps> = ({
  investment,
  managedAsset,
  currentMarketPrice,
  onSubmit,
  onClose,
  getCurrentDateTimeLocalString,
}) => {
  const [formState, setFormState] = useState<{
    unitsToWithdraw: number;
    withdrawalDateTimeLocal: string; // Storing as local string for input
    priceAtWithdrawal: number;
  }>({
    unitsToWithdraw: investment.units, // Default to full withdrawal
    withdrawalDateTimeLocal: getCurrentDateTimeLocalString(),
    priceAtWithdrawal: currentMarketPrice ?? investment.currentPricePerUnitAUD, // Use live price if available, else fallback
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If market price updates externally (e.g., from a refresh), update the form if user hasn't manually changed it
    // This check is a bit simplistic; a more robust way might involve tracking if user touched the field.
    if (currentMarketPrice !== undefined && formState.priceAtWithdrawal !== currentMarketPrice) {
       // Only update if it seems like the initial default or if it matches the old currentPricePerUnitAUD
       if(formState.priceAtWithdrawal === investment.currentPricePerUnitAUD || formState.priceAtWithdrawal === 0) {
           setFormState(prev => ({...prev, priceAtWithdrawal: currentMarketPrice}));
       }
    }
  }, [currentMarketPrice, investment.currentPricePerUnitAUD]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (name === "withdrawalDateTimeLocal") {
        // Value from datetime-local is YYYY-MM-DDTHH:mm
        // We can parse and reformat to ensure consistency if needed, or trust the browser format for now
        // For simplicity, directly using value, assuming valid format from browser.
        setFormState(prev => ({ ...prev, withdrawalDateTimeLocal: value }));
    } else {
        setFormState(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value,
        }));
    }
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formState.unitsToWithdraw <= 0) {
      setError('Units to withdraw must be a positive number.');
      return;
    }
    if (formState.unitsToWithdraw > investment.units) {
      setError(`Cannot withdraw more than available units (${investment.units.toLocaleString()}).`);
      return;
    }
    if (formState.priceAtWithdrawal < 0) { // Price could be 0 in rare scenarios, but not negative
      setError('Price at withdrawal cannot be negative.');
      return;
    }
    if (!formState.withdrawalDateTimeLocal) {
        setError('Withdrawal date and time is required.');
        return;
    }
    
    const utcWithdrawalDateTime = convertLocalToUTCISO(formState.withdrawalDateTimeLocal);
    if (!utcWithdrawalDateTime) {
        setError('Invalid withdrawal date and time. Please ensure it is a valid date and time format.');
        return;
    }
    
    const investmentStartDateObj = new Date(investment.startDate); // investment.startDate is UTC ISO
    const withdrawalDateObj = new Date(utcWithdrawalDateTime); 

    if (withdrawalDateObj.getTime() < investmentStartDateObj.getTime()) {
      setError('Withdrawal date cannot be before the investment start date.');
      return;
    }
    // Optional: Check if withdrawal date is in the future. Usually allowed, but can be restricted.
    // if (withdrawalDateObj.getTime() > new Date().getTime()) {
    //   setError('Withdrawal date cannot be in the future.');
    //   return;
    // }


    const submissionData: WithdrawFormData = {
      unitsToWithdraw: formState.unitsToWithdraw,
      withdrawalDateTime: utcWithdrawalDateTime, // Pass the converted UTC ISO string
      priceAtWithdrawal: formState.priceAtWithdrawal,
    };
    onSubmit(submissionData);
  };

  const assetDisplayName = managedAsset ? `${managedAsset.userGivenName} (${managedAsset.apiId})` : 'Selected Asset';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-sm">
      {error && <p className="text-red-400 bg-red-900 bg-opacity-30 p-3 rounded-md text-sm">{error}</p>}
      
      <p className="text-gray-300">Withdrawing from: <span className="font-semibold text-primary-400">{assetDisplayName}</span></p>
      <p className="text-gray-400 text-xs">Available units: {investment.units.toLocaleString()}</p>

      <div>
        <label htmlFor="unitsToWithdraw" className="block text-sm font-medium text-gray-300 mb-1">Units to Withdraw</label>
        <input
          type="number"
          name="unitsToWithdraw"
          id="unitsToWithdraw"
          value={formState.unitsToWithdraw}
          onChange={handleChange}
          required
          step="any"
          max={investment.units}
          className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
        />
      </div>

      <div>
        <label htmlFor="priceAtWithdrawal" className="block text-sm font-medium text-gray-300 mb-1">Price at Withdrawal (AUD per unit)</label>
        <input
          type="number"
          name="priceAtWWithdithdrawal" 
          id="priceAtWithdrawal"
          value={formState.priceAtWithdrawal}
          onChange={handleChange}
          required
          step="any"
          className="w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-200"
        />
         <p className="text-xs text-gray-400 mt-1">Defaults to current market price if available. Adjust if withdrawal occurred at a different price.</p>
      </div>

      <div>
        <label htmlFor="withdrawalDateTimeLocal" className="block text-sm font-medium text-gray-300 mb-1">Withdrawal Date & Time (Local)</label>
        <input
          type="datetime-local"
          name="withdrawalDateTimeLocal"
          id="withdrawalDateTimeLocal"
          value={formState.withdrawalDateTimeLocal}
          onChange={handleChange}
          required
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
          Confirm Withdrawal
        </button>
      </div>
    </form>
  );
};

export default WithdrawForm;
