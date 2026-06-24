package config

import (
	"os"
	"strconv"
	"time"
)

// BackupConfig holds all configuration for the automated backup service.
type BackupConfig struct {
	DatabaseURL     string
	S3Bucket        string
	S3Region        string
	S3Prefix        string
	RetentionDays   int
	ScheduleHour    int
	TempDir         string
	EncryptionKey   string
	VerifyAfterDump bool
}

// LoadBackupConfig reads backup configuration from environment variables.
func LoadBackupConfig() BackupConfig {
	retentionDays := 30
	if v := os.Getenv("BACKUP_RETENTION_DAYS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			retentionDays = n
		}
	}

	scheduleHour := 3
	if v := os.Getenv("BACKUP_SCHEDULE_HOUR"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 && n < 24 {
			scheduleHour = n
		}
	}

	tempDir := os.Getenv("BACKUP_TEMP_DIR")
	if tempDir == "" {
		tempDir = "/tmp/kor-backups"
	}

	return BackupConfig{
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		S3Bucket:        os.Getenv("BACKUP_S3_BUCKET"),
		S3Region:        getEnvOrDefaultStr("BACKUP_S3_REGION", "us-east-1"),
		S3Prefix:        getEnvOrDefaultStr("BACKUP_S3_PREFIX", "kor-assetforge/backups"),
		RetentionDays:   retentionDays,
		ScheduleHour:    scheduleHour,
		TempDir:         tempDir,
		EncryptionKey:   os.Getenv("BACKUP_ENCRYPTION_KEY"),
		VerifyAfterDump: os.Getenv("BACKUP_VERIFY") != "false",
	}
}

func getEnvOrDefaultStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// NextScheduledRun returns the next time a daily backup should run at ScheduleHour UTC.
func (c BackupConfig) NextScheduledRun() time.Duration {
	now := time.Now().UTC()
	next := time.Date(now.Year(), now.Month(), now.Day(), c.ScheduleHour, 0, 0, 0, time.UTC)
	if !next.After(now) {
		next = next.Add(24 * time.Hour)
	}
	return time.Until(next)
}
