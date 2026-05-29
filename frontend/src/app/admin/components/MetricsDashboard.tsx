'use client';

import React from 'react';
import { Users, TrendingUp, AlertCircle, Activity } from 'lucide-react';

interface MetricCard {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  color: string;
}

export default function AdminMetricsDashboard() {
  const metrics: MetricCard[] = [
    {
      title: 'Total Users',
      value: '2,347',
      change: 12.5,
      icon: <Users className="w-8 h-8" />,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Active Assets',
      value: '523',
      change: 8.2,
      icon: <TrendingUp className="w-8 h-8" />,
      color: 'bg-green-100 text-green-600',
    },
    {
      title: 'Total Volume',
      value: '$2.4M',
      change: 23.1,
      icon: <Activity className="w-8 h-8" />,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      title: 'Pending KYC',
      value: '42',
      change: -5.4,
      icon: <AlertCircle className="w-8 h-8" />,
      color: 'bg-yellow-100 text-yellow-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.title} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
              <div className={`p-3 rounded-lg ${metric.color}`}>
                {metric.icon}
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
              <p className={`text-sm font-medium ${metric.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metric.change >= 0 ? '+' : ''}{metric.change}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">System Health</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">API Health</span>
                <span className="text-sm text-green-600">Healthy</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Database</span>
                <span className="text-sm text-green-600">98% Free</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: '98%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Cache</span>
                <span className="text-sm text-yellow-600">72% Used</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '72%' }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {[
              { type: 'Asset Listed', time: '2 minutes ago', color: 'bg-blue-100' },
              { type: 'KYC Approved', time: '15 minutes ago', color: 'bg-green-100' },
              { type: 'Trade Executed', time: '32 minutes ago', color: 'bg-purple-100' },
              { type: 'User Registered', time: '1 hour ago', color: 'bg-indigo-100' },
              { type: 'Asset Delisted', time: '2 hours ago', color: 'bg-red-100' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded">
                <div className={`w-2 h-2 rounded-full ${activity.color.replace('bg-', 'bg-')}`}></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.type}</p>
                </div>
                <p className="text-xs text-gray-500">{activity.time}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600 mb-2">124ms</p>
            <p className="text-sm text-gray-600">Avg. Response Time</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600 mb-2">99.9%</p>
            <p className="text-sm text-gray-600">Uptime</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-purple-600 mb-2">50.2k</p>
            <p className="text-sm text-gray-600">Requests/Hour</p>
          </div>
        </div>
      </div>
    </div>
  );
}
