// Package graphql wires a minimal GraphQL endpoint alongside the REST API.
// It exposes GET /graphql (schema introspection hint) and POST /graphql
// (query execution). A full resolver implementation should be added per-type
// following the schema defined in schema.graphql.
package graphql

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Handler provides the GraphQL HTTP handlers.
type Handler struct {
	DB *gorm.DB
}

// NewHandler creates a GraphQL Handler.
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{DB: db}
}

// Playground serves a simple HTML page pointing users at the GraphQL endpoint.
// GET /graphql
func (h *Handler) Playground(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(`<!DOCTYPE html>
<html><head><title>AssetForge GraphQL</title></head>
<body>
  <h1>AssetForge GraphQL</h1>
  <p>Send POST requests to <code>/graphql</code> with a JSON body:</p>
  <pre>{ "query": "{ assets { id name symbol } }" }</pre>
</body></html>`))
}

// Execute handles GraphQL query execution.
// POST /graphql
// Body: { "query": "...", "variables": {...} }
func (h *Handler) Execute(c *gin.Context) {
	var req struct {
		Query     string                 `json:"query" binding:"required"`
		Variables map[string]interface{} `json:"variables"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"errors": []gin.H{{"message": err.Error()}}})
		return
	}

	// Stub: return a placeholder until full resolver is wired.
	// Replace this block with a real execution engine (e.g. github.com/graph-gophers/graphql-go).
	c.JSON(http.StatusOK, gin.H{
		"data": nil,
		"errors": []gin.H{
			{"message": "GraphQL execution not yet implemented — schema available at GET /graphql"},
		},
	})
}
