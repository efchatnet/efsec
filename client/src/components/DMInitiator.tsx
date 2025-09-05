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

import React, { useState } from 'react';
import { E2ELockIcon } from './E2ELockIcon';
import { DMService, DMSpace } from '../services/DMService';

export interface DMInitiatorProps {
  peerId: string;
  peerName: string;
  dmService: DMService;
  onDMCreated: (space: DMSpace) => void;
  onError?: (error: Error) => void;
  className?: string;
  buttonText?: string;
}

/**
 * Component to initiate an encrypted DM with another user
 */
export const DMInitiator: React.FC<DMInitiatorProps> = ({
  peerId,
  peerName,
  dmService,
  onDMCreated,
  onError,
  className = '',
  buttonText = 'Start Encrypted Chat'
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitiateDM = async () => {
    setIsInitializing(true);
    setError(null);

    try {
      const dmSpace = await dmService.initiateDM(peerId);
      onDMCreated(dmSpace);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create encrypted chat';
      setError(errorMessage);
      if (onError) {
        onError(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className={`dm-initiator ${className}`}>
      <button
        onClick={handleInitiateDM}
        disabled={isInitializing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          ${isInitializing 
            ? 'bg-gray-300 cursor-not-allowed' 
            : 'bg-green-500 hover:bg-green-600 text-white'
          }
          transition-colors duration-200
        `}
      >
        <E2ELockIcon 
          state={isInitializing ? 'initializing' : 'encrypted'} 
          size="sm" 
        />
        <span>
          {isInitializing ? 'Initializing...' : buttonText}
        </span>
      </button>

      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}

      {isInitializing && (
        <div className="mt-2 text-sm text-gray-600">
          Setting up end-to-end encryption with {peerName}...
        </div>
      )}
    </div>
  );
};

/**
 * Compact DM button for use in user lists or profiles
 */
export const CompactDMButton: React.FC<{
  peerId: string;
  dmService: DMService;
  onDMCreated: (space: DMSpace) => void;
  className?: string;
}> = ({
  peerId,
  dmService,
  onDMCreated,
  className = ''
}) => {
  const [isInitializing, setIsInitializing] = useState(false);

  const handleClick = async () => {
    if (isInitializing) return;
    
    setIsInitializing(true);
    try {
      const dmSpace = await dmService.initiateDM(peerId);
      onDMCreated(dmSpace);
    } catch (error) {
      console.error('Failed to initiate DM:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isInitializing}
      className={`
        p-2 rounded-full
        ${isInitializing 
          ? 'bg-gray-200 cursor-wait' 
          : 'bg-green-500 hover:bg-green-600 text-white'
        }
        transition-all duration-200
        ${className}
      `}
      title="Start encrypted chat"
    >
      {isInitializing ? (
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
          />
        </svg>
      )}
    </button>
  );
};