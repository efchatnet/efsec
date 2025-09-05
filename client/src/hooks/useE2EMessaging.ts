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

import { useCallback, useRef, useState, useEffect } from 'react';
import { SignalManager } from '../protocol/SignalManager';
import { GroupManager } from '../protocol/groups';

export interface E2EConfig {
  apiUrl?: string;
  getAuthToken: () => string | null;
  onTokenExpired?: () => void;
}

export interface E2EMessageHandler {
  encrypt: (recipientId: string, message: string, isGroup?: boolean) => Promise<string>;
  decrypt: (senderId: string, encryptedData: any, isGroup?: boolean) => Promise<string>;
  initialize: (userId: string) => Promise<void>;
  cleanup: () => Promise<void>;
  isReady: () => boolean;
}

export function useE2EMessaging(config: E2EConfig): E2EMessageHandler & { 
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
} {
  const signalManagerRef = useRef<SignalManager | null>(null);
  const configRef = useRef<E2EConfig>(config);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const encrypt = useCallback(async (
    recipientId: string, 
    message: string, 
    isGroup = false
  ): Promise<string> => {
    const manager = signalManagerRef.current;
    if (!manager) {
      console.warn('E2E not ready, sending unencrypted');
      return message;
    }

    try {
      if (isGroup) {
        const groupManager = manager.getGroupManager();
        return await groupManager.encryptMessage(recipientId, message);
      } else {
        const encrypted = await manager.encryptMessage(recipientId, message);
        return JSON.stringify(encrypted);
      }
    } catch (error) {
      console.error('E2E encryption failed:', error);
      // Fallback to unencrypted
      return message;
    }
  }, []);

  const decrypt = useCallback(async (
    senderId: string, 
    encryptedData: any, 
    isGroup = false
  ): Promise<string> => {
    const manager = signalManagerRef.current;
    if (!manager) {
      console.warn('E2E not ready, returning as-is');
      return typeof encryptedData === 'string' ? encryptedData : JSON.stringify(encryptedData);
    }

    try {
      if (isGroup) {
        const groupManager = manager.getGroupManager();
        return await groupManager.decryptMessage(
          encryptedData.groupId, 
          senderId, 
          encryptedData.message
        );
      } else {
        const data = typeof encryptedData === 'string' ? JSON.parse(encryptedData) : encryptedData;
        return await manager.decryptMessage(senderId, data.encrypted, data.type);
      }
    } catch (error) {
      console.error('E2E decryption failed:', error);
      // Return as-is if decryption fails
      return typeof encryptedData === 'string' ? encryptedData : JSON.stringify(encryptedData);
    }
  }, []);

  const initialize = useCallback(async (userId: string): Promise<void> => {
    if (signalManagerRef.current) {
      console.log('E2E already initialized');
      return;
    }

    const authToken = configRef.current.getAuthToken();
    if (!authToken) {
      const error = new Error('No authentication token available');
      setError(error);
      if (configRef.current.onTokenExpired) {
        configRef.current.onTokenExpired();
      }
      throw error;
    }

    setIsInitializing(true);
    setError(null);
    
    try {
      const manager = new SignalManager({
        apiUrl: configRef.current.apiUrl || '/api/e2e',
        authToken: authToken,
        userId: userId,
      });

      await manager.initialize();
      signalManagerRef.current = manager;
      setIsInitialized(true);
      console.log('E2E messaging initialized for user:', userId);
    } catch (error) {
      console.error('Failed to initialize E2E:', error);
      setError(error as Error);
      // E2E is optional, continue without it
    } finally {
      setIsInitializing(false);
    }
  }, []);

  const cleanup = useCallback(async (): Promise<void> => {
    const manager = signalManagerRef.current;
    if (manager) {
      await manager.cleanup();
      signalManagerRef.current = null;
      setIsInitialized(false);
    }
  }, []);

  const isReady = useCallback((): boolean => {
    return signalManagerRef.current !== null && isInitialized;
  }, [isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    encrypt,
    decrypt,
    initialize,
    cleanup,
    isReady,
    isInitialized,
    isInitializing,
    error
  };
}