package models

import "time"

// RateLimitEvent records a single rate-limit violation for analytics.
type RateLimitEvent struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ClientKey  string    `gorm:"not null;index" json:"client_key"` // IP or user identifier
	Endpoint   string    `gorm:"not null;index" json:"endpoint"`
	Method     string    `gorm:"not null" json:"method"`
	HitAt      time.Time `gorm:"not null;index" json:"hit_at"`
	RetryAfter float64   `json:"retry_after_seconds"`
}

// RateLimitSummary is a read-only aggregation used by the dashboard handler.
type RateLimitSummary struct {
	ClientKey  string    `json:"client_key"`
	Endpoint   string    `json:"endpoint"`
	TotalHits  int64     `json:"total_hits"`
	FirstSeen  time.Time `json:"first_seen"`
	LastSeen   time.Time `json:"last_seen"`
}
