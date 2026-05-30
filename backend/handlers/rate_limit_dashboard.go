package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

// RateLimitDashboardHandler exposes rate-limit metrics for the monitoring dashboard.
type RateLimitDashboardHandler struct {
	Redis *redis.Client
}

// NewRateLimitDashboardHandler creates a RateLimitDashboardHandler.
func NewRateLimitDashboardHandler(rdb *redis.Client) *RateLimitDashboardHandler {
	return &RateLimitDashboardHandler{Redis: rdb}
}

// RateLimitStats holds aggregated rate-limit hit data for a key.
type RateLimitStats struct {
	Key       string    `json:"key"`
	Hits      int64     `json:"hits"`
	LastSeen  time.Time `json:"last_seen"`
}

// GetStats returns rate-limit hit counts stored in Redis.
// Keys written by the existing limiter follow the pattern "rate_limiter:<key>".
// GET /api/v1/admin/rate-limit/stats
func (h *RateLimitDashboardHandler) GetStats(c *gin.Context) {
	ctx := context.Background()
	pattern := "rate_limiter:*"

	keys, err := h.Redis.Keys(ctx, pattern).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch rate limit keys"})
		return
	}

	var stats []RateLimitStats
	for _, k := range keys {
		val, err := h.Redis.Get(ctx, k).Int64()
		if err != nil {
			continue
		}
		ttl, _ := h.Redis.TTL(ctx, k).Result()
		stats = append(stats, RateLimitStats{
			Key:      k,
			Hits:     val,
			LastSeen: time.Now().UTC().Add(-ttl),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"count":   len(stats),
		"data":    stats,
	})
}

// ResetKey clears rate-limit state for a specific key (admin action).
// DELETE /api/v1/admin/rate-limit/:key
func (h *RateLimitDashboardHandler) ResetKey(c *gin.Context) {
	key := "rate_limiter:" + c.Param("key")
	ctx := context.Background()
	h.Redis.Del(ctx, key)
	c.JSON(http.StatusOK, gin.H{"success": true, "deleted": key})
}
