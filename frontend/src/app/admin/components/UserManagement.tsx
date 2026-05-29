'use client';

import React, { useState } from 'react';
import { Shield, Trash2, Edit2, Plus } from 'lucide-react';

interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
  verified: boolean;
  createdAt: string;
  status: 'active' | 'suspended' | 'banned';
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<User[]>([
    {
      id: 'user-1',
      email: 'john@example.com',
      role: 'user',
      verified: true,
      createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      status: 'active',
    },
    {
      id: 'user-2',
      email: 'jane@example.com',
      role: 'moderator',
      verified: true,
      createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
      status: 'active',
    },
    {
      id: 'user-3',
      email: 'admin@example.com',
      role: 'admin',
      verified: true,
      createdAt: new Date(Date.now() - 86400000 * 90).toISOString(),
      status: 'active',
    },
  ]);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const handleChangeRole = (userId: string, newRole: 'user' | 'admin' | 'moderator') => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, role: newRole } : u
    ));
    setShowRoleModal(false);
  };

  const handleSuspend = (userId: string) => {
    setUsers(users.map(u => 
      u.id === userId ? { ...u, status: 'suspended' } : u
    ));
  };

  const handleDelete = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700';
      case 'moderator':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'suspended':
        return 'text-yellow-700';
      case 'banned':
        return 'text-red-700';
      default:
        return 'text-green-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Joined</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        user.status === 'active' ? 'bg-green-500' :
                        user.status === 'suspended' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                      <span className={`text-sm ${getStatusColor(user.status)}`}>
                        {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowRoleModal(true);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit role"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSuspend(user.id)}
                        className={`p-2 text-gray-600 hover:bg-gray-100 rounded ${user.status === 'suspended' ? 'opacity-50' : ''}`}
                        title="Suspend user"
                        disabled={user.status === 'suspended'}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Change Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Change Role</h3>
            <p className="text-sm text-gray-600 mb-4">Select new role for {selectedUser.email}</p>
            
            <div className="space-y-2 mb-6">
              {(['user', 'moderator', 'admin'] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => handleChangeRole(selectedUser.id, role)}
                  className={`w-full px-4 py-2 rounded text-left font-medium ${
                    selectedUser.role === role
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-600'
                      : 'bg-gray-100 text-gray-700 border-2 border-transparent'
                  }`}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded font-medium hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
