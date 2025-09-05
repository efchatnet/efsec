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
/**
 * Service for managing Direct Message spaces with E2E encryption
 */
export class DMService {
    constructor(config) {
        this.config = config;
        this.signalManager = config.signalManager;
    }
    /**
     * Initialize or get existing DM space with another user
     * Automatically sets up E2E encryption
     */
    async initiateDM(peerId) {
        const token = this.config.getAuthToken();
        if (!token) {
            throw new Error('Authentication required for encrypted DMs');
        }
        // Check if DM already exists
        const existingDM = await this.findExistingDM(peerId, token);
        if (existingDM) {
            // Ensure E2E session is established
            if (this.signalManager && !existingDM.sessionEstablished) {
                await this.establishE2ESession(peerId);
                existingDM.sessionEstablished = true;
            }
            return existingDM;
        }
        // Create new DM space
        const response = await fetch(`${this.config.apiUrl}/dm/initiate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                peer_id: peerId,
                enable_e2e: true
            })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create DM space: ${error}`);
        }
        const data = await response.json();
        // Establish E2E session
        if (this.signalManager) {
            await this.establishE2ESession(peerId);
        }
        return {
            spaceId: data.space_id,
            userId: data.user_id,
            peerId: peerId,
            isE2EEnabled: data.is_e2e_enabled,
            sessionEstablished: true,
            createdAt: new Date(data.created_at)
        };
    }
    /**
     * Find existing DM space with a user
     */
    async findExistingDM(peerId, token) {
        const response = await fetch(`${this.config.apiUrl}/dm/find?peer_id=${peerId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw new Error('Failed to check for existing DM');
        }
        const data = await response.json();
        return {
            spaceId: data.space_id,
            userId: data.user_id,
            peerId: data.peer_id,
            isE2EEnabled: data.is_e2e_enabled,
            sessionEstablished: data.session_established,
            createdAt: new Date(data.created_at)
        };
    }
    /**
     * Establish E2E encryption session with peer
     */
    async establishE2ESession(peerId) {
        if (!this.signalManager) {
            console.warn('SignalManager not initialized, skipping E2E setup');
            return;
        }
        try {
            await this.signalManager.establishSession(peerId);
            console.log(`E2E session established with ${peerId}`);
        }
        catch (error) {
            console.error(`Failed to establish E2E session with ${peerId}:`, error);
            // Don't throw - allow DM to work without E2E as fallback
        }
    }
    /**
     * Get all DM spaces for current user
     */
    async getUserDMs() {
        const token = this.config.getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        const response = await fetch(`${this.config.apiUrl}/dm/list`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch DM spaces');
        }
        const data = await response.json();
        return data.dms.map((dm) => ({
            spaceId: dm.space_id,
            userId: dm.user_id,
            peerId: dm.peer_id,
            isE2EEnabled: dm.is_e2e_enabled,
            sessionEstablished: dm.session_established,
            createdAt: new Date(dm.created_at)
        }));
    }
    /**
     * Check if a space is an E2E enabled DM
     */
    async isDMSpace(spaceId) {
        const token = this.config.getAuthToken();
        if (!token) {
            return false;
        }
        const response = await fetch(`${this.config.apiUrl}/space/${spaceId}/type`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        return data.space_type === 'dm' && data.is_e2e_enabled;
    }
    /**
     * Enable E2E for an existing private space
     */
    async enableE2EForSpace(spaceId) {
        const token = this.config.getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }
        const response = await fetch(`${this.config.apiUrl}/space/${spaceId}/enable-e2e`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to enable E2E for space');
        }
    }
    /**
     * Set the SignalManager instance
     */
    setSignalManager(signalManager) {
        this.signalManager = signalManager;
    }
}
//# sourceMappingURL=DMService.js.map