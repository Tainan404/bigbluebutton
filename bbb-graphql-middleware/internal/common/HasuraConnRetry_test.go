package common

import (
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestIsTransientHasuraInitCloseCode(t *testing.T) {
	transient := []websocket.StatusCode{4408, 4429}
	for _, code := range transient {
		if !IsTransientHasuraInitCloseCode(code) {
			t.Errorf("expected %v to be transient", code)
		}
	}
	forwarded := []websocket.StatusCode{4403, 4400, 4401, websocket.StatusNormalClosure, websocket.StatusInternalError}
	for _, code := range forwarded {
		if IsTransientHasuraInitCloseCode(code) {
			t.Errorf("expected %v to be forwarded to the browser, not retried", code)
		}
	}
}

func TestHasuraReconnectDelayWithoutFailuresKeepsBaseDelay(t *testing.T) {
	maxRand := func(n int64) int64 { return n - 1 }
	if got := HasuraReconnectDelay(0, maxRand); got != HasuraReconnectBaseDelay {
		t.Errorf("expected base delay %v, got %v", HasuraReconnectBaseDelay, got)
	}
}

func TestHasuraReconnectDelayBackoffGrowsAndIsCapped(t *testing.T) {
	maxRand := func(n int64) int64 { return n - 1 }
	prev := time.Duration(0)
	for failures := 1; failures <= 5; failures++ {
		got := HasuraReconnectDelay(failures, maxRand)
		if got <= prev {
			t.Errorf("expected delay to grow at failure %d: prev=%v got=%v", failures, prev, got)
		}
		prev = got
	}
	// Far beyond the cap (also covers the bit-shift overflow guard)
	capped := HasuraReconnectDelay(1000, maxRand)
	expectedMax := HasuraReconnectBaseDelay + hasuraTransientRetryMaxWindow
	if capped >= expectedMax+time.Millisecond || capped < HasuraReconnectBaseDelay {
		t.Errorf("expected capped delay close to %v, got %v", expectedMax, capped)
	}
}

func TestHasuraReconnectDelayIsRandomized(t *testing.T) {
	minRand := func(n int64) int64 { return 0 }
	maxRand := func(n int64) int64 { return n - 1 }
	low := HasuraReconnectDelay(3, minRand)
	high := HasuraReconnectDelay(3, maxRand)
	if low != HasuraReconnectBaseDelay {
		t.Errorf("expected lower bound %v, got %v", HasuraReconnectBaseDelay, low)
	}
	if high <= low {
		t.Errorf("expected a randomized spread, got low=%v high=%v", low, high)
	}
}

func TestRegisterAndResetHasuraInitTransientFailures(t *testing.T) {
	bc := &BrowserConnection{}
	for i := 1; i <= MaxHasuraTransientRetries; i++ {
		if !bc.RegisterHasuraInitTransientFailure() {
			t.Fatalf("expected retry to be allowed at failure %d", i)
		}
	}
	if bc.RegisterHasuraInitTransientFailure() {
		t.Errorf("expected retries to be exhausted after %d failures", MaxHasuraTransientRetries)
	}
	bc.ResetHasuraInitTransientFailures()
	if !bc.RegisterHasuraInitTransientFailure() {
		t.Errorf("expected retry to be allowed again after reset")
	}
}
