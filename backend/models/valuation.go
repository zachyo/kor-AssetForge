package models

import (
	"time"

	"gorm.io/gorm"
)

// ValuationHistory records a point-in-time valuation snapshot for an asset.
type ValuationHistory struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	AssetID     uint           `gorm:"not null;index" json:"asset_id"`
	Asset       Asset          `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
	ValuationUSD float64       `gorm:"not null" json:"valuation_usd"`
	Currency    string         `gorm:"not null;default:'USD'" json:"currency"`
	Source      string         `gorm:"not null" json:"source"` // manual, sale, revaluation, oracle
	Notes       string         `json:"notes,omitempty"`
	RecordedAt  time.Time      `gorm:"not null;index" json:"recorded_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// ValuationTrend is a computed daily aggregation returned by the analytics endpoint.
type ValuationTrend struct {
	Date         string  `json:"date"`
	AvgValuation float64 `json:"avg_valuation_usd"`
	MinValuation float64 `json:"min_valuation_usd"`
	MaxValuation float64 `json:"max_valuation_usd"`
	Snapshots    int64   `json:"snapshots"`
}
