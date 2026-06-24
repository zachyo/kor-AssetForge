package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/kor-assetforge/models"
	"gorm.io/gorm"
)

// TaxonomyHandler manages category and tag endpoints.
type TaxonomyHandler struct {
	DB *gorm.DB
}

// NewTaxonomyHandler creates a TaxonomyHandler.
func NewTaxonomyHandler(db *gorm.DB) *TaxonomyHandler {
	return &TaxonomyHandler{DB: db}
}

// slugify converts a name to a URL-safe slug.
func slugify(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-")
}

// ── Categories ────────────────────────────────────────────────────────────────

// ListCategories returns the full category tree.
// GET /api/v1/taxonomy/categories
func (h *TaxonomyHandler) ListCategories(c *gin.Context) {
	var categories []models.Category
	if err := h.DB.Where("parent_id IS NULL AND deleted_at IS NULL").
		Preload("Children").
		Order("sort_order, name").
		Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch categories"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": categories})
}

// CreateCategory creates a new category.
// POST /api/v1/taxonomy/categories
func (h *TaxonomyHandler) CreateCategory(c *gin.Context) {
	var req struct {
		Name        string `json:"name" binding:"required,min=1,max=100"`
		Description string `json:"description"`
		ParentID    *uint  `json:"parent_id"`
		SortOrder   int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ParentID != nil {
		var parent models.Category
		if err := h.DB.First(&parent, req.ParentID).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "parent category not found"})
			return
		}
	}

	cat := models.Category{
		Name:        req.Name,
		Slug:        slugify(req.Name),
		Description: req.Description,
		ParentID:    req.ParentID,
		SortOrder:   req.SortOrder,
	}
	if err := h.DB.Create(&cat).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create category"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": cat})
}

// UpdateCategory updates a category's name or description.
// PUT /api/v1/taxonomy/categories/:id
func (h *TaxonomyHandler) UpdateCategory(c *gin.Context) {
	var cat models.Category
	if err := h.DB.First(&cat, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "category not found"})
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		SortOrder   *int    `json:"sort_order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Name != nil {
		cat.Name = *req.Name
		cat.Slug = slugify(*req.Name)
	}
	if req.Description != nil {
		cat.Description = *req.Description
	}
	if req.SortOrder != nil {
		cat.SortOrder = *req.SortOrder
	}

	if err := h.DB.Save(&cat).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": cat})
}

// DeleteCategory soft-deletes a category.
// DELETE /api/v1/taxonomy/categories/:id
func (h *TaxonomyHandler) DeleteCategory(c *gin.Context) {
	if err := h.DB.Delete(&models.Category{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete category"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SetAssetCategories replaces all category assignments for an asset.
// PUT /api/v1/assets/:id/categories
func (h *TaxonomyHandler) SetAssetCategories(c *gin.Context) {
	var req struct {
		CategoryIDs []uint `json:"category_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assetID := c.Param("id")
	if err := h.DB.Delete(&models.AssetCategory{}, "asset_id = ?", assetID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update categories"})
		return
	}

	for _, cid := range req.CategoryIDs {
		h.DB.Create(&models.AssetCategory{AssetID: parseUint(assetID), CategoryID: cid})
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ── Tags ──────────────────────────────────────────────────────────────────────

// ListTags returns all tags sorted by usage count.
// GET /api/v1/taxonomy/tags
func (h *TaxonomyHandler) ListTags(c *gin.Context) {
	var tags []models.Tag
	if err := h.DB.Where("deleted_at IS NULL").Order("usage_count DESC, name").Find(&tags).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch tags"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": tags})
}

// TagAutocomplete returns tags whose name starts with the query prefix.
// GET /api/v1/taxonomy/tags/autocomplete?q=<prefix>
func (h *TaxonomyHandler) TagAutocomplete(c *gin.Context) {
	q := strings.ToLower(strings.TrimSpace(c.Query("q")))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	var tags []models.Tag
	h.DB.Where("deleted_at IS NULL AND name ILIKE ?", q+"%").
		Order("usage_count DESC, name").
		Limit(10).
		Find(&tags)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": tags})
}

// CreateTag creates a new tag.
// POST /api/v1/taxonomy/tags
func (h *TaxonomyHandler) CreateTag(c *gin.Context) {
	var req struct {
		Name  string `json:"name" binding:"required,min=1,max=50"`
		Color string `json:"color"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	color := req.Color
	if color == "" {
		color = "#6366f1"
	}

	tag := models.Tag{
		Name:  strings.ToLower(strings.TrimSpace(req.Name)),
		Slug:  slugify(req.Name),
		Color: color,
	}
	if err := h.DB.Create(&tag).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create tag"})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "data": tag})
}

// DeleteTag soft-deletes a tag.
// DELETE /api/v1/taxonomy/tags/:id
func (h *TaxonomyHandler) DeleteTag(c *gin.Context) {
	if err := h.DB.Delete(&models.Tag{}, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete tag"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SetAssetTags replaces all tag assignments for an asset.
// PUT /api/v1/assets/:id/tags
func (h *TaxonomyHandler) SetAssetTags(c *gin.Context) {
	var req struct {
		TagIDs []uint `json:"tag_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	assetID := c.Param("id")
	assetIDUint := parseUint(assetID)

	h.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Delete(&models.AssetTag{}, "asset_id = ?", assetIDUint).Error; err != nil {
			return err
		}
		for _, tid := range req.TagIDs {
			tx.Create(&models.AssetTag{AssetID: assetIDUint, TagID: tid})
			tx.Model(&models.Tag{}).Where("id = ?", tid).UpdateColumn("usage_count", gorm.Expr("usage_count + 1"))
		}
		return nil
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetAssetTaxonomy returns the categories and tags for an asset.
// GET /api/v1/assets/:id/taxonomy
func (h *TaxonomyHandler) GetAssetTaxonomy(c *gin.Context) {
	assetID := c.Param("id")

	var assetCats []models.AssetCategory
	h.DB.Where("asset_id = ?", assetID).Preload("Category").Find(&assetCats)

	var assetTags []models.AssetTag
	h.DB.Where("asset_id = ?", assetID).Preload("Tag").Find(&assetTags)

	cats := make([]models.Category, 0, len(assetCats))
	for _, ac := range assetCats {
		cats = append(cats, ac.Category)
	}
	tags := make([]models.Tag, 0, len(assetTags))
	for _, at := range assetTags {
		tags = append(tags, at.Tag)
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"categories": cats,
		"tags":       tags,
	}})
}

func parseUint(s string) uint {
	var v uint
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0
		}
		v = v*10 + uint(r-'0')
	}
	return v
}
