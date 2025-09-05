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

import React from 'react';

export type LockState = 'encrypted' | 'unencrypted' | 'initializing' | 'error';

export interface E2ELockIconProps {
  state: LockState;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
};

/**
 * E2E encryption status lock icon
 * - Green closed lock: E2E encrypted
 * - Red open lock: Not encrypted
 * - Yellow lock: Initializing E2E
 * - Orange lock: Error state
 */
export const E2ELockIcon: React.FC<E2ELockIconProps> = ({
  state,
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const sizeClass = sizeClasses[size];
  const textClass = textSizeClasses[size];

  const renderIcon = () => {
    switch (state) {
      case 'encrypted':
        return (
          <div className={`flex items-center gap-1 text-green-500 ${className}`}>
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
            {showLabel && <span className={`font-medium ${textClass}`}>Encrypted</span>}
          </div>
        );

      case 'unencrypted':
        return (
          <div className={`flex items-center gap-1 text-red-500 ${className}`}>
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" 
              />
            </svg>
            {showLabel && <span className={`font-medium ${textClass}`}>Not Encrypted</span>}
          </div>
        );

      case 'initializing':
        return (
          <div className={`flex items-center gap-1 text-yellow-500 ${className}`}>
            <svg className={`${sizeClass} animate-pulse`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth={4} 
                fill="none"
              />
            </svg>
            {showLabel && <span className={`font-medium ${textClass}`}>Initializing...</span>}
          </div>
        );

      case 'error':
        return (
          <div className={`flex items-center gap-1 text-orange-500 ${className}`}>
            <svg className={sizeClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
            {showLabel && <span className={`font-medium ${textClass}`}>Encryption Error</span>}
          </div>
        );

      default:
        return null;
    }
  };

  return <>{renderIcon()}</>;
};

/**
 * Simplified lock indicator for inline use
 */
export const InlineLockIcon: React.FC<{ isEncrypted: boolean; className?: string }> = ({
  isEncrypted,
  className = ''
}) => {
  return (
    <span className={`inline-flex ${className}`}>
      {isEncrypted ? '🔒' : '🔓'}
    </span>
  );
};