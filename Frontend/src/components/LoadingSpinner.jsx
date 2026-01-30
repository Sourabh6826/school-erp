import React from 'react';

const LoadingSpinner = ({ message = "Loading data...", fullPage = false }) => {
    const spinnerContent = (
        <div className="flex flex-col items-center justify-center py-12 transition-all duration-500 animate-in fade-in zoom-in">
            <div className="relative">
                {/* Outer Glow */}
                <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>

                {/* Main Spinner */}
                <div className="w-16 h-16 border-4 border-gray-100 border-t-blue-600 rounded-full animate-spin shadow-inner"></div>

                {/* Center Dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div>
            </div>

            <div className="mt-6 text-center">
                <p className="text-sm font-black text-gray-800 uppercase tracking-[0.2em] animate-pulse">
                    {message}
                </p>
                <div className="mt-2 flex gap-1 justify-center">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                </div>
            </div>
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-md z-[9999] flex items-center justify-center">
                {spinnerContent}
            </div>
        );
    }

    return spinnerContent;
};

export default LoadingSpinner;
