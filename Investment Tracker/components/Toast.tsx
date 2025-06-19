import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 5000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  let bgColor = 'bg-blue-500';
  if (type === 'error') bgColor = 'bg-red-600';
  if (type === 'success') bgColor = 'bg-green-600';

  return (
    <div className={`fixed top-5 right-5 z-[150] p-4 rounded-md shadow-lg text-white ${bgColor} flex items-center justify-between transition-transform transform-gpu animate-fadeInOut`}>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-4 text-white hover:text-gray-200 text-xl font-bold"
        aria-label="Close notification"
      >
        &times;
      </button>
    </div>
  );
};

export default Toast;

// Add basic fade in/out animation for the toast
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(-20px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-20px); }
  }
  .animate-fadeInOut {
    animation: fadeInOut ${5000 / 1000}s ease-in-out forwards;
  }
`;
document.head.appendChild(style);
