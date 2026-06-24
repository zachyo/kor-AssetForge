package models

import "time"

// ActivityType categorises a user action for the activity timeline.
type ActivityType string

const (
	ActivityLogin          ActivityType = "login"
	ActivityTokenize       ActivityType = "tokenize"
	ActivityTransfer       ActivityType = "transfer"
	ActivityList           ActivityType = "list"
	ActivityPurchase       ActivityType = "purchase"
	ActivityStake          ActivityType = "stake"
	ActivityUnstake        ActivityType = "unstake"
	ActivityWatchlistAdd   ActivityType = "watchlist_add"
	ActivityWatchlistRemove ActivityType = "watchlist_remove"
	ActivityKYCSubmit      ActivityType = "kyc_submit"
	ActivityDisputeFiled   ActivityType = "dispute_filed"
)

// UserActivity records a timestamped event in a user's activity timeline.
type UserActivity struct {
	ID         uint         `gorm:"primaryKey" json:"id"`
	UserID     uint         `gorm:"not null;index" json:"user_id"`
	Type       ActivityType `gorm:"not null;index" json:"type"`
	ResourceID string       `gorm:"index" json:"resource_id,omitempty"`
	ResourceType string     `json:"resource_type,omitempty"`
	Metadata   string       `gorm:"type:text" json:"metadata,omitempty"`
	IPAddress  string       `json:"ip_address,omitempty"`
	CreatedAt  time.Time    `gorm:"index" json:"created_at"`
}
