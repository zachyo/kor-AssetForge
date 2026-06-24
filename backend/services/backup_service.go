package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/yourusername/kor-assetforge/config"
)

// BackupService creates and uploads encrypted PostgreSQL backups to S3.
type BackupService struct {
	cfg config.BackupConfig
	s3  *s3.Client
}

// BackupResult contains metadata about a completed backup operation.
type BackupResult struct {
	Filename  string
	S3Key     string
	SizeBytes int64
	Duration  time.Duration
	Verified  bool
}

// NewBackupService creates a BackupService using the provided config.
// It initialises the AWS S3 client from environment credentials.
func NewBackupService(cfg config.BackupConfig) (*BackupService, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithRegion(cfg.S3Region),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	return &BackupService{cfg: cfg, s3: s3.NewFromConfig(awsCfg)}, nil
}

// Run performs a full backup cycle: dump → verify → upload → purge old backups.
func (s *BackupService) Run(ctx context.Context) (*BackupResult, error) {
	start := time.Now()

	if err := os.MkdirAll(s.cfg.TempDir, 0o700); err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}

	filename := fmt.Sprintf("backup_%s.sql.gz", time.Now().UTC().Format("20060102_150405"))
	localPath := filepath.Join(s.cfg.TempDir, filename)

	if err := s.dump(ctx, localPath); err != nil {
		return nil, fmt.Errorf("pg_dump: %w", err)
	}
	defer os.Remove(localPath)

	info, err := os.Stat(localPath)
	if err != nil {
		return nil, fmt.Errorf("stat dump file: %w", err)
	}

	verified := false
	if s.cfg.VerifyAfterDump {
		verified = s.verify(ctx, localPath)
		if !verified {
			log.Printf("[backup] warning: verification failed for %s", filename)
		}
	}

	s3Key := fmt.Sprintf("%s/%s", strings.TrimSuffix(s.cfg.S3Prefix, "/"), filename)
	if err := s.upload(ctx, localPath, s3Key); err != nil {
		return nil, fmt.Errorf("s3 upload: %w", err)
	}

	go s.purgeOld(context.Background())

	return &BackupResult{
		Filename:  filename,
		S3Key:     s3Key,
		SizeBytes: info.Size(),
		Duration:  time.Since(start),
		Verified:  verified,
	}, nil
}

func (s *BackupService) dump(ctx context.Context, dest string) error {
	cmd := exec.CommandContext(ctx, "sh", "-c",
		fmt.Sprintf("pg_dump --no-password %q | gzip > %q", s.cfg.DatabaseURL, dest),
	)
	cmd.Env = append(os.Environ(), "PGPASSWORD=")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("pg_dump failed: %w — %s", err, string(out))
	}
	return nil
}

func (s *BackupService) verify(ctx context.Context, path string) bool {
	cmd := exec.CommandContext(ctx, "sh", "-c", fmt.Sprintf("gunzip -t %q", path))
	return cmd.Run() == nil
}

func (s *BackupService) upload(ctx context.Context, localPath, s3Key string) error {
	f, err := os.Open(localPath)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = s.s3.PutObject(ctx, &s3.PutObjectInput{
		Bucket:               aws.String(s.cfg.S3Bucket),
		Key:                  aws.String(s3Key),
		Body:                 f,
		ServerSideEncryption: "AES256",
	})
	return err
}

func (s *BackupService) purgeOld(ctx context.Context) {
	cutoff := time.Now().UTC().AddDate(0, 0, -s.cfg.RetentionDays)
	prefix := s.cfg.S3Prefix + "/"

	out, err := s.s3.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.cfg.S3Bucket),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		log.Printf("[backup] purgeOld list error: %v", err)
		return
	}

	for _, obj := range out.Contents {
		if obj.LastModified != nil && obj.LastModified.Before(cutoff) {
			if _, err := s.s3.DeleteObject(ctx, &s3.DeleteObjectInput{
				Bucket: aws.String(s.cfg.S3Bucket),
				Key:    obj.Key,
			}); err != nil {
				log.Printf("[backup] failed to delete %s: %v", aws.ToString(obj.Key), err)
			} else {
				log.Printf("[backup] deleted expired backup: %s", aws.ToString(obj.Key))
			}
		}
	}
}

// Schedule runs a daily backup at the configured hour until ctx is cancelled.
func (s *BackupService) Schedule(ctx context.Context) {
	for {
		delay := s.cfg.NextScheduledRun()
		log.Printf("[backup] next run in %s", delay.Round(time.Minute))

		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}

		result, err := s.Run(ctx)
		if err != nil {
			log.Printf("[backup] run failed: %v", err)
		} else {
			log.Printf("[backup] completed: %s (%.1f MB, verified=%v, took=%s)",
				result.S3Key,
				float64(result.SizeBytes)/(1<<20),
				result.Verified,
				result.Duration.Round(time.Second),
			)
		}
	}
}

// DownloadAndRestore downloads a backup from S3 and restores it to the target database.
func (s *BackupService) DownloadAndRestore(ctx context.Context, s3Key, targetDSN string) error {
	localPath := filepath.Join(s.cfg.TempDir, filepath.Base(s3Key))
	if err := os.MkdirAll(s.cfg.TempDir, 0o700); err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.Remove(localPath)

	out, err := s.s3.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.S3Bucket),
		Key:    aws.String(s3Key),
	})
	if err != nil {
		return fmt.Errorf("s3 get: %w", err)
	}
	defer out.Body.Close()

	f, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("create local file: %w", err)
	}
	if _, err := io.Copy(f, out.Body); err != nil {
		f.Close()
		return fmt.Errorf("write local file: %w", err)
	}
	f.Close()

	cmd := exec.CommandContext(ctx, "sh", "-c",
		fmt.Sprintf("gunzip -c %q | psql %q", localPath, targetDSN),
	)
	if out2, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("restore failed: %w — %s", err, string(out2))
	}
	return nil
}
