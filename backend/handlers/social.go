package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SocialHandler handles social feature endpoints (profiles, follows, comments).
type SocialHandler struct {
	DB *gorm.DB
}

// NewSocialHandler creates a SocialHandler.
func NewSocialHandler(db *gorm.DB) *SocialHandler {
	return &SocialHandler{DB: db}
}

// UserFollow represents a follower relationship.
type UserFollow struct {
	FollowerID uint `gorm:"not null;index" json:"follower_id"`
	FolloweeID uint `gorm:"not null;index" json:"followee_id"`
}

// AssetComment represents a user comment on an asset.
type AssetComment struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	AssetID uint   `gorm:"not null;index" json:"asset_id"`
	UserID  uint   `gorm:"not null;index" json:"user_id"`
	Body    string `gorm:"not null" json:"body"`
}

// GetProfile returns a user's public profile by ID.
// GET /api/v1/social/profiles/:id
func (h *SocialHandler) GetProfile(c *gin.Context) {
	id := c.Param("id")
	var user struct {
		ID             uint   `json:"id"`
		Username       string `json:"username"`
		StellarAddress string `json:"stellar_address"`
	}
	if err := h.DB.Table("users").Select("id, username, stellar_address").
		Where("id = ? AND deleted_at IS NULL", id).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

// FollowUser records a follow relationship.
// POST /api/v1/social/follow/:id
func (h *SocialHandler) FollowUser(c *gin.Context) {
	followerID, _ := c.Get("user_id")
	followeeID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || uint(followeeID) == followerID.(uint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid followee id"})
		return
	}
	follow := UserFollow{FollowerID: followerID.(uint), FolloweeID: uint(followeeID)}
	h.DB.FirstOrCreate(&follow, follow)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// AddComment posts a comment on an asset.
// POST /api/v1/social/assets/:id/comments
func (h *SocialHandler) AddComment(c *gin.Context) {
	userID, _ := c.Get("user_id")
	assetID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}
	var body struct {
		Body string `json:"body" binding:"required,min=1,max=1000"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	comment := AssetComment{AssetID: uint(assetID), UserID: userID.(uint), Body: body.Body}
	h.DB.Create(&comment)
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": comment})
}

// GetComments lists comments on an asset.
// GET /api/v1/social/assets/:id/comments
func (h *SocialHandler) GetComments(c *gin.Context) {
	assetID := c.Param("id")
	var comments []AssetComment
	h.DB.Where("asset_id = ?", assetID).Find(&comments)
	c.JSON(http.StatusOK, gin.H{"success": true, "data": comments})
}
