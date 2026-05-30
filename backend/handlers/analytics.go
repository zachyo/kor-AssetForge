package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// AnalyticsHandler handles analytics and reporting endpoints.
type AnalyticsHandler struct {
	DB *gorm.DB
}

// NewAnalyticsHandler creates an AnalyticsHandler.
func NewAnalyticsHandler(db *gorm.DB) *AnalyticsHandler {
	return &AnalyticsHandler{DB: db}
}

// PlatformSummary holds aggregated platform metrics.
type PlatformSummary struct {
	TotalUsers      int64   `json:"total_users"`
	TotalAssets     int64   `json:"total_assets"`
	TotalVolume     float64 `json:"total_volume_xlm"`
	ActiveListings  int64   `json:"active_listings"`
	ReportGeneratedAt time.Time `json:"report_generated_at"`
}

// GetSummary returns key platform metrics.
// GET /api/v1/analytics/summary
func (h *AnalyticsHandler) GetSummary(c *gin.Context) {
	var summary PlatformSummary
	summary.ReportGeneratedAt = time.Now().UTC()

	h.DB.Table("users").Where("deleted_at IS NULL").Count(&summary.TotalUsers)
	h.DB.Table("assets").Where("deleted_at IS NULL").Count(&summary.TotalAssets)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": summary})
}

// GetUserGrowth returns a daily user-registration time series.
// GET /api/v1/analytics/user-growth?days=30
func (h *AnalyticsHandler) GetUserGrowth(c *gin.Context) {
	days := 30
	if d := c.Query("days"); d != "" {
		if parsed, err := time.ParseDuration(d + "h"); err == nil {
			days = int(parsed.Hours() / 24)
		}
	}
	since := time.Now().UTC().AddDate(0, 0, -days)

	type DailyCount struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
	}
	var rows []DailyCount
	h.DB.Raw(`
		SELECT DATE(created_at) AS date, COUNT(*) AS count
		FROM users
		WHERE created_at >= ? AND deleted_at IS NULL
		GROUP BY DATE(created_at)
		ORDER BY date ASC`, since).Scan(&rows)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": rows, "days": days})
}
