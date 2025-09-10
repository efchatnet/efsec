// Copyright (C) 2025 efchat.net <tj@efchat.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	
	"github.com/redis/go-redis/v9"
	"github.com/efchatnet/efsec/backend/models"
)

const (
	// TTL for different message types
	KeyDistributionTTL = 24 * time.Hour    // Key distribution messages expire after 24 hours
	RegularDMTTL       = 7 * 24 * time.Hour // Regular DMs expire after 7 days
	
	// Redis key prefixes
	dmQueuePrefix = "dm:queue:"     // dm:queue:{userId} - list of message IDs
	dmMessagePrefix = "dm:msg:"     // dm:msg:{messageId} - message content
	dmUnreadPrefix = "dm:unread:"   // dm:unread:{userId} - set of unread message IDs
)

type DMStore struct {
	rdb *redis.Client
	ctx context.Context
}

func NewDMStore(rdb *redis.Client) *DMStore {
	return &DMStore{
		rdb: rdb,
		ctx: context.Background(),
	}
}

// SaveDM stores an encrypted DM in Redis with appropriate TTL
func (s *DMStore) SaveDM(dm models.EncryptedDM) error {
	// Serialize the message
	data, err := json.Marshal(dm)
	if err != nil {
		return fmt.Errorf("failed to marshal DM: %w", err)
	}
	
	// Determine TTL based on message type
	ttl := RegularDMTTL
	if dm.MessageType == "key_distribution" {
		ttl = KeyDistributionTTL
	}
	
	// Store the message with TTL
	messageKey := dmMessagePrefix + dm.MessageID
	if err := s.rdb.Set(s.ctx, messageKey, data, ttl).Err(); err != nil {
		return fmt.Errorf("failed to store message: %w", err)
	}
	
	// Add to recipient's queue (FIFO)
	queueKey := dmQueuePrefix + dm.RecipientID
	if err := s.rdb.RPush(s.ctx, queueKey, dm.MessageID).Err(); err != nil {
		return fmt.Errorf("failed to add to queue: %w", err)
	}
	
	// Set queue expiration to match longest message TTL
	s.rdb.Expire(s.ctx, queueKey, RegularDMTTL)
	
	// Mark as unread
	unreadKey := dmUnreadPrefix + dm.RecipientID
	if err := s.rdb.SAdd(s.ctx, unreadKey, dm.MessageID).Err(); err != nil {
		return fmt.Errorf("failed to mark as unread: %w", err)
	}
	s.rdb.Expire(s.ctx, unreadKey, RegularDMTTL)
	
	// Publish notification for real-time delivery
	notificationData := map[string]string{
		"type": "new_dm",
		"message_id": dm.MessageID,
		"sender_id": dm.SenderID,
		"message_type": dm.MessageType,
	}
	notification, _ := json.Marshal(notificationData)
	s.rdb.Publish(s.ctx, "dm:notify:"+dm.RecipientID, notification)
	
	return nil
}

// GetDMsForUser retrieves DMs for a user from their queue
func (s *DMStore) GetDMsForUser(userID string, messageType string, limit int) ([]models.EncryptedDM, error) {
	queueKey := dmQueuePrefix + userID
	
	// Get message IDs from queue (most recent first)
	messageIDs, err := s.rdb.LRange(s.ctx, queueKey, int64(-limit), -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get message queue: %w", err)
	}
	
	// Retrieve messages
	var dms []models.EncryptedDM
	for i := len(messageIDs) - 1; i >= 0; i-- { // Reverse to get newest first
		messageKey := dmMessagePrefix + messageIDs[i]
		
		data, err := s.rdb.Get(s.ctx, messageKey).Result()
		if err == redis.Nil {
			// Message expired or deleted, remove from queue
			s.rdb.LRem(s.ctx, queueKey, 1, messageIDs[i])
			continue
		} else if err != nil {
			return nil, fmt.Errorf("failed to get message: %w", err)
		}
		
		var dm models.EncryptedDM
		if err := json.Unmarshal([]byte(data), &dm); err != nil {
			continue // Skip malformed messages
		}
		
		// Filter by message type if specified
		if messageType == "" || dm.MessageType == messageType {
			dms = append(dms, dm)
		}
	}
	
	return dms, nil
}

// GetDMsBetweenUsers retrieves conversation between two users
func (s *DMStore) GetDMsBetweenUsers(userID1, userID2 string, limit int) ([]models.EncryptedDM, error) {
	// Get messages from both users' queues
	dms1, err := s.GetDMsForUser(userID1, "", limit)
	if err != nil {
		return nil, err
	}
	
	dms2, err := s.GetDMsForUser(userID2, "", limit)
	if err != nil {
		return nil, err
	}
	
	// Filter for conversation between these two users
	var conversation []models.EncryptedDM
	seen := make(map[string]bool)
	
	for _, dm := range dms1 {
		if (dm.SenderID == userID2 || dm.RecipientID == userID2) && !seen[dm.MessageID] {
			conversation = append(conversation, dm)
			seen[dm.MessageID] = true
		}
	}
	
	for _, dm := range dms2 {
		if (dm.SenderID == userID1 || dm.RecipientID == userID1) && !seen[dm.MessageID] {
			conversation = append(conversation, dm)
			seen[dm.MessageID] = true
		}
	}
	
	// Sort by timestamp (newest first)
	// Note: In production, you'd want proper timestamp sorting
	
	// Limit results
	if len(conversation) > limit {
		conversation = conversation[:limit]
	}
	
	return conversation, nil
}

// MarkDMAsRead marks a message as read
func (s *DMStore) MarkDMAsRead(messageID, userID string) error {
	unreadKey := dmUnreadPrefix + userID
	
	// Remove from unread set
	if err := s.rdb.SRem(s.ctx, unreadKey, messageID).Err(); err != nil {
		return fmt.Errorf("failed to mark as read: %w", err)
	}
	
	// Update read timestamp in message (optional)
	messageKey := dmMessagePrefix + messageID
	data, err := s.rdb.Get(s.ctx, messageKey).Result()
	if err == nil {
		var dm models.EncryptedDM
		if json.Unmarshal([]byte(data), &dm) == nil {
			now := time.Now()
			dm.ReadAt = &now
			if updated, err := json.Marshal(dm); err == nil {
				// Preserve remaining TTL
				ttl := s.rdb.TTL(s.ctx, messageKey).Val()
				s.rdb.Set(s.ctx, messageKey, updated, ttl)
			}
		}
	}
	
	return nil
}

// DeleteDMForUser removes a message from user's queue
func (s *DMStore) DeleteDMForUser(messageID, userID string) error {
	queueKey := dmQueuePrefix + userID
	
	// Remove from queue
	if err := s.rdb.LRem(s.ctx, queueKey, 1, messageID).Err(); err != nil {
		return fmt.Errorf("failed to remove from queue: %w", err)
	}
	
	// Remove from unread set
	unreadKey := dmUnreadPrefix + userID
	s.rdb.SRem(s.ctx, unreadKey, messageID)
	
	// Note: We don't delete the actual message as the sender might still need it
	// It will expire based on TTL
	
	return nil
}

// GetUnreadCount returns the number of unread messages for a user
func (s *DMStore) GetUnreadCount(userID string) (int64, error) {
	unreadKey := dmUnreadPrefix + userID
	return s.rdb.SCard(s.ctx, unreadKey).Result()
}

// SubscribeToDMs subscribes to real-time DM notifications for a user
func (s *DMStore) SubscribeToDMs(userID string) *redis.PubSub {
	return s.rdb.Subscribe(s.ctx, "dm:notify:"+userID)
}

// CleanupExpiredMessages removes expired message IDs from queues
// This should be run periodically as a background job
func (s *DMStore) CleanupExpiredMessages() error {
	// Get all user queues
	iter := s.rdb.Scan(s.ctx, 0, dmQueuePrefix+"*", 0).Iterator()
	
	for iter.Next(s.ctx) {
		queueKey := iter.Val()
		
		// Get all message IDs in queue
		messageIDs, err := s.rdb.LRange(s.ctx, queueKey, 0, -1).Result()
		if err != nil {
			continue
		}
		
		// Check each message and remove expired ones
		for _, messageID := range messageIDs {
			messageKey := dmMessagePrefix + messageID
			exists := s.rdb.Exists(s.ctx, messageKey).Val()
			if exists == 0 {
				// Message expired, remove from queue
				s.rdb.LRem(s.ctx, queueKey, 1, messageID)
			}
		}
		
		// Remove empty queues
		length := s.rdb.LLen(s.ctx, queueKey).Val()
		if length == 0 {
			s.rdb.Del(s.ctx, queueKey)
		}
	}
	
	return iter.Err()
}

func (s *DMStore) DeleteDMsBetweenUsers(user1, user2 string) error {
	// Get all messages between these users
	messages1, err := s.GetDMsBetweenUsers(user1, user2, 1000)
	if err != nil {
		return fmt.Errorf("failed to get DMs for cleanup: %w", err)
	}
	
	// Delete messages from both users' queues
	for _, dm := range messages1 {
		s.DeleteDMForUser(dm.MessageID, user1)
		s.DeleteDMForUser(dm.MessageID, user2)
	}
	
	return nil
}