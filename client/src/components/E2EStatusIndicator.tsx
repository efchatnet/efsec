// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

import React, { useState, useEffect } from 'react';

interface E2EStatusIndicatorProps {
  isEncrypted: boolean;
  isInitializing?: boolean;
  conversationId?: string;
  className?: string;
}

export const E2EStatusIndicator: React.FC<E2EStatusIndicatorProps> = ({
  isEncrypted,
  isInitializing = false,
  conversationId,
  className = ''
}) => {
  if (!conversationId) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isEncrypted ? (
        <div className="flex items-center gap-1 text-green-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
            />
          </svg>
          <span className="text-xs font-medium">End-to-end encrypted</span>
        </div>
      ) : isInitializing ? (
        <div className="flex items-center gap-1 text-gray-400">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
            />
          </svg>
          <span className="text-xs">Initializing encryption...</span>
        </div>
      ) : null}
    </div>
  );
};