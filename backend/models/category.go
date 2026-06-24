package models

import (
	"time"

	"gorm.io/gorm"
)

// Category represents a hierarchical asset category.
type Category struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"not null;uniqueIndex:idx_category_name_parent" json:"name"`
	Slug        string         `gorm:"not null;uniqueIndex" json:"slug"`
	Description string         `json:"description"`
	ParentID    *uint          `gorm:"index;uniqueIndex:idx_category_name_parent" json:"parent_id,omitempty"`
	Parent      *Category      `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children    []Category     `gorm:"foreignKey:ParentID" json:"children,omitempty"`
	SortOrder   int            `gorm:"default:0" json:"sort_order"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// AssetCategory is the join table linking assets to their categories.
type AssetCategory struct {
	AssetID    uint      `gorm:"primaryKey;not null" json:"asset_id"`
	CategoryID uint      `gorm:"primaryKey;not null" json:"category_id"`
	Category   Category  `gorm:"foreignKey:CategoryID" json:"category,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}
