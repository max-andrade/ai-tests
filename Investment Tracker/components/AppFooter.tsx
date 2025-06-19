
import React from 'react';
// import { StorageType } from '../types'; // No longer needed for display

interface AppFooterProps {
  // storageType: StorageType; // Removed as it's no longer dynamic in this way
}

const AppFooter: React.FC<AppFooterProps> = (/* { storageType } */) => {
  return (
    <footer className="text-center mt-12 py-6 border-t border-gray-700">
      <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} Investment Tracker. All rights reserved.</p>
      <p className="text-xs text-gray-600 mt-1">
        Primary Storage: <span className="font-semibold text-primary-400">Local Browser</span>.
        Use "Export JSON" for local backups. Use "Save to Server" / "Update from Server" to sync with Azure Cloud.
      </p>
    </footer>
  );
};

export default AppFooter;