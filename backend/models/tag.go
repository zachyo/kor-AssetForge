package models

import (
	"time"

	"gorm.io/gorm"
)

// Tag represents a user-defined label that can be applied to assets.
type Tag struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"not null;uniqueIndex" json:"name"`
	Slug      string         `gorm:"not null;uniqueIndex" json:"slug"`
	Color     string         `gorm:"default:'#6366f1'" json:"color"`
	UsageCount uint          `gorm:"default:0" json:"usage_count"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// AssetTag is the join table linking assets to tags.
type AssetTag struct {
	AssetID   uint      `gorm:"primaryKey;not null" json:"asset_id"`
	TagID     uint      `gorm:"primaryKey;not null" json:"tag_id"`
	Tag       Tag       `gorm:"foreignKey:TagID" json:"tag,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
