"use strict";
// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedChat = void 0;
const solid_js_1 = require("solid-js");
const E2EProvider_1 = require("./E2EProvider");
const E2EIndicator_1 = require("./E2EIndicator");
const EncryptedChat = (props) => {
    const e2e = (0, E2EProvider_1.useE2E)();
    const [inputMessage, setInputMessage] = (0, solid_js_1.createSignal)('');
    const [sending, setSending] = (0, solid_js_1.createSignal)(false);
    const [sessionEstablished, setSessionEstablished] = (0, solid_js_1.createSignal)(false);
    const [decryptedMessages, setDecryptedMessages] = (0, solid_js_1.createSignal)(new Map());
    // Check session status
    (0, solid_js_1.createEffect)(async () => {
        if (e2e.isInitialized()) {
            const hasSession = await e2e.hasSession(props.recipientId);
            setSessionEstablished(hasSession);
        }
    });
    // Decrypt incoming messages
    (0, solid_js_1.createEffect)(() => {
        props.messages.forEach(async (msg) => {
            if (!msg.isOutgoing && msg.ciphertext && !decryptedMessages().has(msg.id)) {
                try {
                    const decrypted = await e2e.decryptMessage(msg.senderId, msg.ciphertext, msg.messageType);
                    setDecryptedMessages(prev => {
                        const newMap = new Map(prev);
                        newMap.set(msg.id, decrypted);
                        return newMap;
                    });
                    props.onDecryptMessage?.(msg.id, decrypted);
                }
                catch (err) {
                    console.error('Failed to decrypt message:', err);
                    setDecryptedMessages(prev => {
                        const newMap = new Map(prev);
                        newMap.set(msg.id, '[Failed to decrypt]');
                        return newMap;
                    });
                }
            }
        });
    });
    const handleSend = async () => {
        const message = inputMessage().trim();
        if (!message || sending() || !e2e.isInitialized())
            return;
        setSending(true);
        try {
            const result = await e2e.sendEncryptedMessage(props.recipientId, message);
            const encryptedMsg = {
                id: result.message_id,
                senderId: props.currentUserId,
                recipientId: props.recipientId,
                ciphertext: result.ciphertext,
                messageType: result.message_type,
                timestamp: new Date(result.timestamp),
                decrypted: message,
                isOutgoing: true
            };
            props.onSendMessage?.(encryptedMsg);
            setInputMessage('');
            setSessionEstablished(true);
        }
        catch (err) {
            console.error('Failed to send encrypted message:', err);
            alert('Failed to send message. Please try again.');
        }
        finally {
            setSending(false);
        }
    };
    const getMessageContent = (msg) => {
        if (msg.isOutgoing) {
            return msg.decrypted || msg.ciphertext;
        }
        return decryptedMessages().get(msg.id) || 'Decrypting...';
    };
    return (<div class={`flex flex-col h-full ${props.class || ''}`}>
      {/* Header with E2E indicator */}
      <div class="flex items-center justify-between p-4 border-b">
        <div class="flex items-center gap-3">
          <h2 class="text-xl font-semibold">{props.recipientName}</h2>
          <E2EIndicator_1.E2EIndicator enabled={e2e.isInitialized()} sessionEstablished={sessionEstablished()}/>
        </div>
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <solid_js_1.Show when={props.messages.length > 0} fallback={<div class="text-center text-gray-500 mt-8">
              <p>No messages yet. Start an encrypted conversation!</p>
              <p class="text-sm mt-2">🔒 Messages are end-to-end encrypted</p>
            </div>}>
          <solid_js_1.For each={props.messages}>
            {(msg) => (<div class={`flex ${msg.isOutgoing ? 'justify-end' : 'justify-start'}`}>
                <div class={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.isOutgoing
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-900'}`}>
                  <p class="break-words">{getMessageContent(msg)}</p>
                  <div class="flex items-center justify-between mt-1">
                    <span class={`text-xs ${msg.isOutgoing ? 'text-blue-100' : 'text-gray-500'}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                    <span class="text-xs ml-2">🔒</span>
                  </div>
                </div>
              </div>)}
          </solid_js_1.For>
        </solid_js_1.Show>
      </div>

      {/* Input */}
      <div class="border-t p-4">
        <solid_js_1.Show when={e2e.isInitialized()} fallback={<div class="text-center text-gray-500">
              <p>Initializing encryption...</p>
            </div>}>
          <div class="flex gap-2">
            <input type="text" value={inputMessage()} onInput={(e) => setInputMessage(e.currentTarget.value)} onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        }} placeholder="Type an encrypted message..." class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500" disabled={sending()}/>
            <button onClick={handleSend} disabled={!inputMessage().trim() || sending()} class={`px-6 py-2 rounded-lg font-medium transition-colors ${!inputMessage().trim() || sending()
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {sending() ? 'Sending...' : 'Send'}
            </button>
          </div>
          <solid_js_1.Show when={e2e.isEstablishingSession()}>
            <p class="text-sm text-gray-500 mt-2">Establishing encrypted session...</p>
          </solid_js_1.Show>
        </solid_js_1.Show>
      </div>
    </div>);
};
exports.EncryptedChat = EncryptedChat;
//# sourceMappingURL=EncryptedChat.jsx.map