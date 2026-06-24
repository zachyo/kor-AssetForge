package models

import (
	"time"

	"gorm.io/gorm"
)

// Watchlist is a named collection of assets bookmarked by a user.
type Watchlist struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	UserID      uint            `gorm:"not null;index" json:"user_id"`
	User        User            `gorm:"foreignKey:UserID" json:"-"`
	Name        string          `gorm:"not null" json:"name"`
	Description string          `json:"description"`
	IsPublic    bool            `gorm:"default:false" json:"is_public"`
	Items       []WatchlistItem `gorm:"foreignKey:WatchlistID" json:"items,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
	DeletedAt   gorm.DeletedAt  `gorm:"index" json:"-"`
}

// WatchlistItem is a single asset entry within a watchlist.
type WatchlistItem struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	WatchlistID uint      `gorm:"not null;index" json:"watchlist_id"`
	AssetID     uint      `gorm:"not null;index" json:"asset_id"`
	Asset       Asset     `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
	Notes       string    `json:"notes"`
	AlertPrice  *float64  `json:"alert_price,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}
