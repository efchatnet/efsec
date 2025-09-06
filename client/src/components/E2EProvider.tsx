// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { createContext, useContext, createSignal, onMount, JSX } from 'solid-js';
import { EfSecClient } from '../index';

interface E2EContextType {
  client: EfSecClient | null;
  isInitialized: () => boolean;
  isEstablishingSession: () => boolean;
  error: () => string | null;
  initializeE2E: (apiUrl: string, authToken: string, userId: string) => Promise<void>;
  sendEncryptedMessage: (recipientId: string, message: string) => Promise<Uint8Array>;
  decryptMessage: (senderId: string, encryptedData: Uint8Array) => Promise<string>;
  hasSession: (userId: string) => boolean;
  createGroup: (groupId: string) => Promise<void>;
  encryptGroupMessage: (groupId: string, message: string) => Promise<Uint8Array>;
  decryptGroupMessage: (groupId: string, senderId: string, ciphertext: Uint8Array) => Promise<string>;
}

const E2EContext = createContext<E2EContextType>();

export interface E2EProviderProps {
  children: JSX.Element;
  apiUrl: string;
  authToken: string | null;
  userId: string | null;
  autoInitialize?: boolean;
}

export function E2EProvider(props: E2EProviderProps) {
  const [client, setClient] = createSignal<EfSecClient | null>(null);
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [isEstablishingSession, setIsEstablishingSession] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const initializeE2E = async (apiUrl: string, authToken: string, userId: string) => {
    try {
      setError(null);
      const efsecClient = new EfSecClient(apiUrl);
      await efsecClient.init(authToken);
      setClient(efsecClient);
      setIsInitialized(true);
      console.log('E2E encryption initialized with vodozemac WASM');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize E2E encryption';
      setError(errorMessage);
      throw err;
    }
  };

  const sendEncryptedMessage = async (recipientId: string, message: string): Promise<Uint8Array> => {
    const currentClient = client();
    if (!currentClient) {
      throw new Error('E2E client not initialized');
    }

    try {
      setIsEstablishingSession(true);
      
      // Establish session if not exists
      if (!hasSession(recipientId)) {
        await currentClient.startDMSession(recipientId);
      }
      
      const encryptedData = await currentClient.encryptDM(recipientId, message);
      return encryptedData;
    } finally {
      setIsEstablishingSession(false);
    }
  };

  const decryptMessage = async (senderId: string, encryptedData: Uint8Array): Promise<string> => {
    const currentClient = client();
    if (!currentClient) {
      throw new Error('E2E client not initialized');
    }

    return await currentClient.decryptDM(senderId, encryptedData);
  };

  const hasSession = (userId: string): boolean => {
    const currentClient = client();
    if (!currentClient) {return false;}
    
    // Check if we have a session with this user
    // This is a simplified check - in a real implementation we'd check the internal state
    return true; // Placeholder
  };

  const createGroup = async (groupId: string): Promise<void> => {
    const currentClient = client();
    if (!currentClient) {
      throw new Error('E2E client not initialized');
    }

    await currentClient.createGroup(groupId);
  };

  const encryptGroupMessage = async (groupId: string, message: string): Promise<Uint8Array> => {
    const currentClient = client();
    if (!currentClient) {
      throw new Error('E2E client not initialized');
    }

    return await currentClient.encryptGroupMessage(groupId, message);
  };

  const decryptGroupMessage = async (groupId: string, senderId: string, ciphertext: Uint8Array): Promise<string> => {
    const currentClient = client();
    if (!currentClient) {
      throw new Error('E2E client not initialized');
    }

    return await currentClient.decryptGroupMessage(groupId, senderId, 0, ciphertext);
  };

  // Auto-initialize if requested and we have the required props
  onMount(() => {
    if (props.autoInitialize && props.authToken && props.userId) {
      initializeE2E(props.apiUrl, props.authToken, props.userId).catch(err => {
        console.error('Auto-initialization failed:', err);
      });
    }
  });

  const value: E2EContextType = {
    client: client(),
    isInitialized,
    isEstablishingSession,
    error,
    initializeE2E,
    sendEncryptedMessage,
    decryptMessage,
    hasSession,
    createGroup,
    encryptGroupMessage,
    decryptGroupMessage
  };

  return (
    <E2EContext.Provider value={value}>
      {props.children}
    </E2EContext.Provider>
  );
}

export function useE2E() {
  const context = useContext(E2EContext);
  if (!context) {
    throw new Error('useE2E must be used within E2EProvider');
  }
  return context;
}