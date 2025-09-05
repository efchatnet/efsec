// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { createContext, useContext, createSignal, JSX } from 'solid-js';

interface E2EContextType {
  signalManager: null;
  isInitialized: () => boolean;
  isEstablishingSession: () => boolean;
  error: () => string | null;
  initializeE2E: (apiUrl: string, authToken: string, userId: string) => Promise<void>;
  sendEncryptedMessage: (recipientId: string, message: string) => Promise<any>;
  decryptMessage: (senderId: string, encryptedData: string, messageType: number) => Promise<string>;
  hasSession: (userId: string) => Promise<boolean>;
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
  const [isInitialized] = createSignal(false);
  const [isEstablishingSession] = createSignal(false);
  const [error] = createSignal<string | null>('E2E encryption not available: Signal Protocol requires native dependencies not supported in browsers');

  const initializeE2E = async (apiUrl: string, authToken: string, userId: string) => {
    throw new Error('E2E encryption not available: Signal Protocol requires native dependencies not supported in browsers');
  };

  const sendEncryptedMessage = async (recipientId: string, message: string) => {
    throw new Error('E2E encryption not available in browsers');
  };

  const decryptMessage = async (senderId: string, encryptedData: string, messageType: number) => {
    throw new Error('E2E encryption not available in browsers');
  };

  const hasSession = async (userId: string) => {
    return false;
  };

  // E2E disabled in browser environment

  const value: E2EContextType = {
    signalManager: null,
    isInitialized,
    isEstablishingSession,
    error,
    initializeE2E,
    sendEncryptedMessage,
    decryptMessage,
    hasSession
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