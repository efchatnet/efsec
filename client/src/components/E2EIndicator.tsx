// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

import { Component } from 'solid-js';

export interface E2EIndicatorProps {
  enabled: boolean;
  sessionEstablished: boolean;
  class?: string;
}

export const E2EIndicator: Component<E2EIndicatorProps> = (props) => {
  const getIndicatorColor = () => {
    if (!props.enabled) return 'text-gray-400';
    return props.sessionEstablished ? 'text-green-500' : 'text-yellow-500';
  };

  const getTooltipText = () => {
    if (!props.enabled) return 'E2E encryption not available';
    return props.sessionEstablished 
      ? 'End-to-end encrypted conversation' 
      : 'Setting up encrypted session...';
  };

  const getIcon = () => {
    if (!props.enabled) return '🔓';
    return props.sessionEstablished ? '🔒' : '🔑';
  };

  return (
    <div 
      class={`flex items-center gap-1 text-sm ${props.class || ''}`}
      title={getTooltipText()}
    >
      <span class={getIndicatorColor()}>{getIcon()}</span>
      <span class={`${getIndicatorColor()} font-medium`}>
        {props.enabled ? 
          (props.sessionEstablished ? 'E2E' : 'Setting up...') : 
          'No encryption'
        }
      </span>
    </div>
  );
};