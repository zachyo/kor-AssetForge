package models

import (
	"time"

	"gorm.io/gorm"
)

// ImportJob tracks the progress of a bulk asset tokenization request.
type ImportJob struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        uint           `gorm:"not null;index" json:"user_id"`
	User          User           `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Filename      string         `gorm:"not null" json:"filename"`
	Format        string         `gorm:"not null" json:"format"` // csv, json
	Status        string         `gorm:"not null;default:'pending'" json:"status"` // pending, processing, completed, failed
	TotalRows     int            `gorm:"default:0" json:"total_rows"`
	ProcessedRows int            `gorm:"default:0" json:"processed_rows"`
	SuccessRows   int            `gorm:"default:0" json:"success_rows"`
	FailedRows    int            `gorm:"default:0" json:"failed_rows"`
	ErrorDetails  string         `gorm:"type:text" json:"error_details,omitempty"`
	CreatedAssets string         `gorm:"type:text" json:"created_asset_ids,omitempty"` // JSON array of created asset IDs
	StartedAt     *time.Time     `json:"started_at,omitempty"`
	CompletedAt   *time.Time     `json:"completed_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// BulkAssetRow is a single row parsed from a CSV or JSON import file.
type BulkAssetRow struct {
	Name         string            `json:"name" csv:"name"`
	Symbol       string            `json:"symbol" csv:"symbol"`
	Description  string            `json:"description" csv:"description"`
	AssetType    string            `json:"asset_type" csv:"asset_type"`
	TotalSupply  int64             `json:"total_supply" csv:"total_supply"`
	Fractions    uint64            `json:"fractions" csv:"fractions"`
	OwnerAddress string            `json:"owner_address" csv:"owner_address"`
	PriceUSD     float64           `json:"price_usd" csv:"price_usd"`
	Currency     string            `json:"currency" csv:"currency"`
	Metadata     map[string]string `json:"metadata,omitempty"`
}

// BulkAssetRowError records a validation error for a specific row.
type BulkAssetRowError struct {
	Row     int    `json:"row"`
	Field   string `json:"field"`
	Message string `json:"message"`
}
