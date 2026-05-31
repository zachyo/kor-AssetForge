"use client";

import { useState } from 'react';

export default function InsurancePage() {
  const [activeTab, setActiveTab] = useState<'purchase' | 'claim'>('purchase');
  const [assetId, setAssetId] = useState('');
  const [premium, setPremium] = useState('');
  const [coverage, setCoverage] = useState('');

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Purchasing policy for Asset ${assetId} with coverage ${coverage}`);
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Filing claim for Asset ${assetId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Asset Insurance</h1>
        
        <div className="flex space-x-4 mb-8 border-b border-gray-200 dark:border-gray-700">
          <button
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'purchase'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('purchase')}
          >
            Purchase Policy
          </button>
          <button
            className={`pb-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'claim'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('claim')}
          >
            File Claim
          </button>
        </div>

        {activeTab === 'purchase' ? (
          <form onSubmit={handlePurchase} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Asset ID</label>
              <input
                type="text"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Coverage Amount (XLM)</label>
              <input
                type="number"
                value={coverage}
                onChange={(e) => setCoverage(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Premium (XLM)</label>
              <input
                type="number"
                value={premium}
                onChange={(e) => setPremium(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Purchase Policy
            </button>
          </form>
        ) : (
          <form onSubmit={handleClaim} className="space-y-4 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
             <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Policy ID</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Claim Amount (XLM)</label>
              <input
                type="number"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Evidence Hash (IPFS)</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Submit Claim
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
