package validator

import (
	"errors"
	"mime/multipart"
	"path/filepath"
	"strings"

	"github.com/yourusername/kor-assetforge/services"
)

// AllowedImportExtensions lists the file extensions accepted for bulk upload.
var AllowedImportExtensions = map[string]bool{
	".csv":  true,
	".json": true,
}

// ValidateBulkUploadFile checks that the uploaded file meets size and type requirements.
// It returns the detected format ("csv" or "json") on success.
func ValidateBulkUploadFile(fh *multipart.FileHeader) (string, error) {
	if fh.Size > services.MaxImportFileBytes {
		return "", errors.New("file exceeds the 10 MB limit")
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !AllowedImportExtensions[ext] {
		return "", errors.New("only .csv and .json files are supported")
	}

	format := strings.TrimPrefix(ext, ".")
	return format, nil
}
