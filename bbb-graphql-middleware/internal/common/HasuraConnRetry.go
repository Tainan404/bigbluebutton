package common

import (
	"math/rand"
	"time"

	"github.com/coder/websocket"
)

const (
	// Base delay before (re)creating the Hasura connection of a browser connection.
	HasuraReconnectBaseDelay = 100 * time.Millisecond
	// Backoff bounds applied after consecutive transient init failures (e.g. 4408).
	hasuraTransientRetryInitialWindow = 500 * time.Millisecond
	hasuraTransientRetryMaxWindow     = 8 * time.Second
	// After this many consecutive transient init failures the close error is
	// forwarded to the browser (previous behavior), so the client takes over.
	MaxHasuraTransientRetries = 10
)

// IsTransientHasuraInitCloseCode reports whether a close code received from Hasura
// represents a transient connection-initialisation failure that is worth retrying
// on the middleware side instead of dropping the browser connection.
// 4408 = "Connection initialisation timed out", 4429 = "Too many initialisation requests"
// (graphql-transport-ws protocol). Both happen when many connections initialise at
// the same time (e.g. after a meeting-wide lock settings change invalidates all
// locked viewers) and succeed once retried. Authorization failures (4403) and any
// other close code are still forwarded to the browser.
func IsTransientHasuraInitCloseCode(code websocket.StatusCode) bool {
	return code == websocket.StatusCode(4408) || code == websocket.StatusCode(4429)
}

// RegisterHasuraInitTransientFailure accounts one transient init failure and reports
// whether the middleware should retry the Hasura connection (true) or give up and
// forward the close error to the browser (false).
func (bc *BrowserConnection) RegisterHasuraInitTransientFailure() bool {
	bc.Lock()
	defer bc.Unlock()
	bc.HasuraInitTransientFailures++
	return bc.HasuraInitTransientFailures <= MaxHasuraTransientRetries
}

// ResetHasuraInitTransientFailures clears the failure counter (called once Hasura
// acknowledges a connection).
func (bc *BrowserConnection) ResetHasuraInitTransientFailures() {
	bc.Lock()
	defer bc.Unlock()
	bc.HasuraInitTransientFailures = 0
}

// NextHasuraReconnectDelay returns how long to wait before (re)creating the Hasura
// connection of this browser connection.
func (bc *BrowserConnection) NextHasuraReconnectDelay() time.Duration {
	bc.RLock()
	failures := bc.HasuraInitTransientFailures
	bc.RUnlock()
	return HasuraReconnectDelay(failures, rand.Int63n)
}

// HasuraReconnectDelay computes the reconnection delay: the base delay when there is
// no transient init failure being retried (previous fixed behavior), otherwise the
// base delay plus a randomized exponential backoff ("full jitter"). The random spread
// is the important part: when a burst of connections is invalidated at once (meeting-wide
// lock settings change), it prevents all of them from retrying in lockstep against Hasura.
// randInt63n is injected to keep the function testable.
func HasuraReconnectDelay(consecutiveTransientFailures int, randInt63n func(n int64) int64) time.Duration {
	if consecutiveTransientFailures <= 0 {
		return HasuraReconnectBaseDelay
	}
	window := hasuraTransientRetryInitialWindow << (consecutiveTransientFailures - 1)
	if window > hasuraTransientRetryMaxWindow || window <= 0 {
		window = hasuraTransientRetryMaxWindow
	}
	return HasuraReconnectBaseDelay + time.Duration(randInt63n(int64(window)))
}
