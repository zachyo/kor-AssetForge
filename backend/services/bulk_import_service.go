package services

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/yourusername/kor-assetforge/models"
	"gorm.io/gorm"
)

const (
	maxImportRows    = 1000
	maxImportFileMB  = 10
	MaxImportFileBytes = maxImportFileMB * 1024 * 1024
)

// BulkImportService handles parsing and processing of CSV/JSON asset import files.
type BulkImportService struct {
	db *gorm.DB
}

// NewBulkImportService creates a BulkImportService.
func NewBulkImportService(db *gorm.DB) *BulkImportService {
	return &BulkImportService{db: db}
}

// ParseCSV reads a CSV reader and returns parsed rows plus any per-row validation errors.
func (s *BulkImportService) ParseCSV(r io.Reader) ([]models.BulkAssetRow, []models.BulkAssetRowError) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, []models.BulkAssetRowError{{Row: 0, Field: "file", Message: "cannot read CSV header"}}
	}
	colIndex := make(map[string]int)
	for i, h := range header {
		colIndex[strings.ToLower(strings.TrimSpace(h))] = i
	}

	var rows []models.BulkAssetRow
	var errs []models.BulkAssetRowError
	rowNum := 1

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "file", Message: err.Error()})
			rowNum++
			continue
		}
		if rowNum > maxImportRows {
			errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "file", Message: fmt.Sprintf("exceeded maximum of %d rows", maxImportRows)})
			break
		}

		row, rowErrs := s.parseCSVRow(record, colIndex, rowNum)
		if len(rowErrs) > 0 {
			errs = append(errs, rowErrs...)
		} else {
			rows = append(rows, row)
		}
		rowNum++
	}

	return rows, errs
}

// ParseJSON parses a JSON array of asset objects.
func (s *BulkImportService) ParseJSON(r io.Reader) ([]models.BulkAssetRow, []models.BulkAssetRowError) {
	var raw []json.RawMessage
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, []models.BulkAssetRowError{{Row: 0, Field: "file", Message: "invalid JSON: " + err.Error()}}
	}

	if len(raw) > maxImportRows {
		return nil, []models.BulkAssetRowError{{Row: 0, Field: "file", Message: fmt.Sprintf("exceeded maximum of %d rows", maxImportRows)}}
	}

	var rows []models.BulkAssetRow
	var errs []models.BulkAssetRowError

	for i, item := range raw {
		var row models.BulkAssetRow
		if err := json.Unmarshal(item, &row); err != nil {
			errs = append(errs, models.BulkAssetRowError{Row: i + 1, Field: "json", Message: err.Error()})
			continue
		}
		if rowErrs := validateBulkRow(row, i+1); len(rowErrs) > 0 {
			errs = append(errs, rowErrs...)
		} else {
			rows = append(rows, row)
		}
	}

	return rows, errs
}

// ProcessRows inserts validated rows as Asset records and updates the ImportJob.
func (s *BulkImportService) ProcessRows(job *models.ImportJob, rows []models.BulkAssetRow) error {
	now := time.Now().UTC()
	job.StartedAt = &now
	job.Status = "processing"
	job.TotalRows = len(rows)
	s.db.Save(job)

	var createdIDs []uint
	var failDetails []string

	for i, row := range rows {
		asset := models.Asset{
			Name:         row.Name,
			Symbol:       strings.ToUpper(row.Symbol),
			Description:  row.Description,
			AssetType:    row.AssetType,
			TotalSupply:  row.TotalSupply,
			Fractions:    row.Fractions,
			OwnerAddress: row.OwnerAddress,
			Verified:     false,
		}
		if row.Metadata != nil {
			if b, err := json.Marshal(row.Metadata); err == nil {
				asset.Metadata = string(b)
			}
		}

		if err := s.db.Create(&asset).Error; err != nil {
			job.FailedRows++
			failDetails = append(failDetails, fmt.Sprintf("row %d (%s): %s", i+1, row.Symbol, err.Error()))
		} else {
			job.SuccessRows++
			createdIDs = append(createdIDs, asset.ID)
		}
		job.ProcessedRows++
	}

	completedAt := time.Now().UTC()
	job.CompletedAt = &completedAt
	job.Status = "completed"
	if job.FailedRows > 0 && job.SuccessRows == 0 {
		job.Status = "failed"
	}
	if len(failDetails) > 0 {
		job.ErrorDetails = strings.Join(failDetails, "\n")
	}
	if len(createdIDs) > 0 {
		if b, err := json.Marshal(createdIDs); err == nil {
			job.CreatedAssets = string(b)
		}
	}

	return s.db.Save(job).Error
}

func (s *BulkImportService) parseCSVRow(record []string, colIndex map[string]int, rowNum int) (models.BulkAssetRow, []models.BulkAssetRowError) {
	get := func(col string) string {
		if idx, ok := colIndex[col]; ok && idx < len(record) {
			return strings.TrimSpace(record[idx])
		}
		return ""
	}

	supply, _ := strconv.ParseInt(get("total_supply"), 10, 64)
	fractions, _ := strconv.ParseUint(get("fractions"), 10, 64)
	priceUSD, _ := strconv.ParseFloat(get("price_usd"), 64)

	row := models.BulkAssetRow{
		Name:         get("name"),
		Symbol:       get("symbol"),
		Description:  get("description"),
		AssetType:    get("asset_type"),
		TotalSupply:  supply,
		Fractions:    fractions,
		OwnerAddress: get("owner_address"),
		PriceUSD:     priceUSD,
		Currency:     get("currency"),
	}

	return row, validateBulkRow(row, rowNum)
}

func validateBulkRow(row models.BulkAssetRow, rowNum int) []models.BulkAssetRowError {
	var errs []models.BulkAssetRowError
	if strings.TrimSpace(row.Name) == "" {
		errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "name", Message: "name is required"})
	}
	if strings.TrimSpace(row.Symbol) == "" {
		errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "symbol", Message: "symbol is required"})
	}
	if row.TotalSupply <= 0 {
		errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "total_supply", Message: "total_supply must be > 0"})
	}
	if strings.TrimSpace(row.OwnerAddress) == "" {
		errs = append(errs, models.BulkAssetRowError{Row: rowNum, Field: "owner_address", Message: "owner_address is required"})
	}
	return errs
}
