package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	currencyCachePrefix = "kor:fx:"
	currencyCacheTTL    = 15 * time.Minute
)

// SupportedCurrencies is the set of fiat and crypto currencies the platform accepts.
var SupportedCurrencies = []string{"USD", "EUR", "GBP", "XLM", "BTC", "ETH"}

// ExchangeRates holds the conversion rates relative to USD.
type ExchangeRates struct {
	Base      string             `json:"base"`
	Rates     map[string]float64 `json:"rates"`
	FetchedAt time.Time          `json:"fetched_at"`
}

// CurrencyService converts amounts between supported currencies.
type CurrencyService struct {
	httpClient *http.Client
	redis      *redis.Client
	apiBaseURL string // e.g. https://open.er-api.com/v6/latest
}

// NewCurrencyService creates a CurrencyService.
// apiBaseURL should be the exchange-rate API base, e.g. https://open.er-api.com/v6/latest
func NewCurrencyService(rdb *redis.Client, apiBaseURL string) *CurrencyService {
	return &CurrencyService{
		httpClient: &http.Client{Timeout: 10 * time.Second},
		redis:      rdb,
		apiBaseURL: apiBaseURL,
	}
}

// GetRates returns exchange rates relative to USD, using a Redis cache to avoid
// hitting the upstream API on every request. Falls back to a minimal hardcoded
// snapshot if the cache is cold and the upstream is unreachable.
func (s *CurrencyService) GetRates(ctx context.Context) (*ExchangeRates, error) {
	cacheKey := currencyCachePrefix + "rates"

	if s.redis != nil {
		if raw, err := s.redis.Get(ctx, cacheKey).Bytes(); err == nil {
			var rates ExchangeRates
			if json.Unmarshal(raw, &rates) == nil {
				return &rates, nil
			}
		}
	}

	rates, err := s.fetchFromAPI(ctx)
	if err != nil {
		// Return a static fallback so the service degrades gracefully.
		return s.fallbackRates(), nil
	}

	if s.redis != nil {
		if data, err := json.Marshal(rates); err == nil {
			s.redis.Set(ctx, cacheKey, data, currencyCacheTTL)
		}
	}

	return rates, nil
}

// Convert converts `amount` from `fromCurrency` to `toCurrency`.
// Both currency codes must be in SupportedCurrencies.
func (s *CurrencyService) Convert(ctx context.Context, amount float64, from, to string) (float64, error) {
	if from == to {
		return amount, nil
	}

	rates, err := s.GetRates(ctx)
	if err != nil {
		return 0, fmt.Errorf("currency service unavailable: %w", err)
	}

	fromRate, ok := rates.Rates[from]
	if !ok {
		return 0, fmt.Errorf("unsupported currency: %s", from)
	}
	toRate, ok := rates.Rates[to]
	if !ok {
		return 0, fmt.Errorf("unsupported currency: %s", to)
	}

	// Convert via USD as the common denominator.
	amountInUSD := amount / fromRate
	return amountInUSD * toRate, nil
}

// IsSupportedCurrency returns true if code is in SupportedCurrencies.
func IsSupportedCurrency(code string) bool {
	for _, c := range SupportedCurrencies {
		if c == code {
			return true
		}
	}
	return false
}

func (s *CurrencyService) fetchFromAPI(ctx context.Context) (*ExchangeRates, error) {
	url := s.apiBaseURL + "/USD"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("exchange rate API returned status %d", resp.StatusCode)
	}

	var payload struct {
		BaseCode string             `json:"base_code"`
		Rates    map[string]float64 `json:"rates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}

	return &ExchangeRates{
		Base:      payload.BaseCode,
		Rates:     payload.Rates,
		FetchedAt: time.Now().UTC(),
	}, nil
}

func (s *CurrencyService) fallbackRates() *ExchangeRates {
	return &ExchangeRates{
		Base: "USD",
		Rates: map[string]float64{
			"USD": 1.0,
			"EUR": 0.92,
			"GBP": 0.79,
			"XLM": 8.93,  // approximate; updated by live API when available
			"BTC": 0.000016,
			"ETH": 0.00031,
		},
		FetchedAt: time.Now().UTC(),
	}
}
