'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';
import AdminKYCReview from './components/KYCReview';
import AdminUserManagement from './components/UserManagement';
import AdminMetricsDashboard from './components/MetricsDashboard';
import AdminComplianceReports from './components/ComplianceReports';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-500">Platform management and monitoring</p>
        </div>
      </div>

      {/* Admin Content */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-white rounded-lg border border-gray-200">
            <TabsTrigger 
              value="overview"
              className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="kyc"
              className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600"
            >
              KYC Review
            </TabsTrigger>
            <TabsTrigger 
              value="users"
              className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600"
            >
              Users
            </TabsTrigger>
            <TabsTrigger 
              value="compliance"
              className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600"
            >
              Compliance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminMetricsDashboard />
          </TabsContent>

          <TabsContent value="kyc">
            <AdminKYCReview />
          </TabsContent>

          <TabsContent value="users">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="compliance">
            <AdminComplianceReports />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
