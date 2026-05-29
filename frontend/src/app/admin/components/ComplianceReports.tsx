'use client';

import React, { useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';

interface ComplianceReport {
  id: string;
  name: string;
  type: 'aml' | 'kyc' | 'transaction' | 'risk';
  generatedAt: string;
  period: string;
  status: 'completed' | 'pending' | 'failed';
}

export default function AdminComplianceReports() {
  const [reports, setReports] = useState<ComplianceReport[]>([
    {
      id: 'report-1',
      name: 'AML Compliance Report',
      type: 'aml',
      generatedAt: new Date().toISOString(),
      period: 'May 2026',
      status: 'completed',
    },
    {
      id: 'report-2',
      name: 'KYC Verification Report',
      type: 'kyc',
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
      period: 'May 2026',
      status: 'completed',
    },
    {
      id: 'report-3',
      name: 'Transaction Report',
      type: 'transaction',
      generatedAt: new Date(Date.now() - 172800000).toISOString(),
      period: 'May 2026',
      status: 'completed',
    },
    {
      id: 'report-4',
      name: 'Risk Assessment Report',
      type: 'risk',
      generatedAt: new Date().toISOString(),
      period: 'May 2026',
      status: 'pending',
    },
  ]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'aml':
        return 'bg-red-100 text-red-700';
      case 'kyc':
        return 'bg-blue-100 text-blue-700';
      case 'transaction':
        return 'bg-green-100 text-green-700';
      case 'risk':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Compliance Reports</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Generate New Report
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Report Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Period</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Generated</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <p className="font-medium text-gray-900">{report.name}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(report.type)}`}>
                      {report.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {report.period}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(report.generatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${getStatusColor(report.status)}`}>
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3">
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" title="View report">
                        <Eye className="w-4 h-4" />
                      </button>
                      {report.status === 'completed' && (
                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded" title="Download report">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Compliance Checklist</h2>
        <div className="space-y-4">
          {[
            { item: 'Anti-Money Laundering (AML) Policy', completed: true },
            { item: 'Know Your Customer (KYC) Process', completed: true },
            { item: 'Data Protection & Privacy', completed: true },
            { item: 'Transaction Monitoring', completed: true },
            { item: 'Risk Assessment', completed: false },
            { item: 'Audit Trail Maintenance', completed: true },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
              <input
                type="checkbox"
                checked={item.completed}
                readOnly
                className="w-4 h-4 rounded"
              />
              <span className={`text-sm ${item.completed ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                {item.item}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
