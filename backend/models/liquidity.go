package models

import (
	"time"

	"gorm.io/gorm"
)

// LiquidityPool represents an AMM-style pool for two assets
type LiquidityPool struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	AssetAID     uint           `gorm:"not null;index" json:"asset_a_id"`
	AssetA       Asset          `gorm:"foreignKey:AssetAID" json:"asset_a,omitempty"`
	AssetBID     uint           `gorm:"not null;index" json:"asset_b_id"`
	AssetB       Asset          `gorm:"foreignKey:AssetBID" json:"asset_b,omitempty"`
	ReserveA     int64          `gorm:"default:0" json:"reserve_a"`
	ReserveB     int64          `gorm:"default:0" json:"reserve_b"`
	TotalLPTokens int64         `gorm:"default:0" json:"total_lp_tokens"`
	FeeBasisPoints int          `gorm:"default:30" json:"fee_basis_points"` // 30 = 0.30%
	CreatorAddress string       `gorm:"not null" json:"creator_address"`
	Active        bool          `gorm:"default:true" json:"active"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// LiquidityPosition represents an LP's share in a pool
type LiquidityPosition struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	PoolID        uint           `gorm:"not null;index" json:"pool_id"`
	Pool          LiquidityPool  `gorm:"foreignKey:PoolID" json:"pool,omitempty"`
	ProviderAddress string       `gorm:"not null;index" json:"provider_address"`
	LPTokens      int64          `gorm:"default:0" json:"lp_tokens"`
	DepositedA    int64          `gorm:"default:0" json:"deposited_a"`
	DepositedB    int64          `gorm:"default:0" json:"deposited_b"`
	FeesEarned    int64          `gorm:"default:0" json:"fees_earned"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// PoolSwap records a swap executed through a liquidity pool
type PoolSwap struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	PoolID          uint      `gorm:"not null;index" json:"pool_id"`
	TraderAddress   string    `gorm:"not null" json:"trader_address"`
	InputAssetID    uint      `gorm:"not null" json:"input_asset_id"`
	OutputAssetID   uint      `gorm:"not null" json:"output_asset_id"`
	InputAmount     int64     `gorm:"not null" json:"input_amount"`
	OutputAmount    int64     `gorm:"not null" json:"output_amount"`
	FeeAmount       int64     `gorm:"not null" json:"fee_amount"`
	PriceImpactBps  int       `json:"price_impact_bps"`
	TxHash          string    `gorm:"index" json:"tx_hash,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}
