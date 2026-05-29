'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface KYCSubmission {
  id: string;
  userId: string;
  userEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  documents: {
    id_document: string;
    proof_of_address: string;
  };
}

export default function AdminKYCReview() {
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([
    {
      id: 'kyc-001',
      userId: 'user-1',
      userEmail: 'john@example.com',
      status: 'pending',
      submittedAt: new Date().toISOString(),
      documents: {
        id_document: 'https://example.com/doc1',
        proof_of_address: 'https://example.com/doc2',
      },
    },
    {
      id: 'kyc-002',
      userId: 'user-2',
      userEmail: 'jane@example.com',
      status: 'approved',
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
      documents: {
        id_document: 'https://example.com/doc3',
        proof_of_address: 'https://example.com/doc4',
      },
    },
  ]);

  const handleApprove = (id: string) => {
    setSubmissions(submissions.map(s => 
      s.id === id ? { ...s, status: 'approved' } : s
    ));
  };

  const handleReject = (id: string) => {
    setSubmissions(submissions.map(s => 
      s.id === id ? { ...s, status: 'rejected' } : s
    ));
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">KYC Submissions</h2>
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>{pendingCount}</strong> submissions pending review
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">User</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Submitted</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Documents</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{submission.userEmail}</p>
                      <p className="text-sm text-gray-500">{submission.userId}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {submission.status === 'pending' && (
                        <>
                          <Clock className="w-4 h-4 text-yellow-500 mr-2" />
                          <span className="text-sm text-yellow-700">Pending</span>
                        </>
                      )}
                      {submission.status === 'approved' && (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                          <span className="text-sm text-green-700">Approved</span>
                        </>
                      )}
                      {submission.status === 'rejected' && (
                        <>
                          <XCircle className="w-4 h-4 text-red-500 mr-2" />
                          <span className="text-sm text-red-700">Rejected</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(submission.submittedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <a 
                        href={submission.documents.id_document}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        ID
                      </a>
                      <span className="text-gray-300">•</span>
                      <a 
                        href={submission.documents.proof_of_address}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        Address
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {submission.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(submission.id)}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(submission.id)}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
