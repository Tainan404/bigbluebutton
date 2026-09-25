package streamingserver

import (
	"bytes"
	"encoding/json"
	"maps"
	"sync"

	"bbb-graphql-middleware/internal/common"
)

var (
	QueryIdPlaceholder        = "--------------QUERY-ID--------------" // 36 chars
	QueryIdPlaceholderInBytes = []byte(QueryIdPlaceholder)
)

// cursorIsHiddenForLockedViewers reports whether this cursor event must be withheld
// from locked viewers. The lock state travels with the event (instead of being frozen
// into each receiver's session), so a hideViewersCursor change applies to the very
// next event without refreshing any session. When the field is absent (event produced
// by an older akka-apps) it falls back to hiding every viewer cursor from locked
// viewers, which is the privacy-safe direction.
func cursorIsHiddenForLockedViewers(eventBody map[string]interface{}, cursorIsFromViewer bool) bool {
	if hiddenForLockedViewers, hasLockStateInEvent := eventBody["hiddenForLockedViewers"].(bool); hasLockStateInEvent {
		return hiddenForLockedViewers
	}
	return cursorIsFromViewer
}

func HandleSendCursorPositionEvtMsg(receivedMessage common.RedisMessage, browserConnectionsMutex *sync.RWMutex, browserConnections map[string]*common.BrowserConnection) {
	receivedCursorIsFromViewer := receivedMessage.Core.Body["userIsViewer"].(bool)
	xPercent := receivedMessage.Core.Body["xPercent"].(float64)
	yPercent := receivedMessage.Core.Body["yPercent"].(float64)
	cursorHiddenForLockedViewers := cursorIsHiddenForLockedViewers(receivedMessage.Core.Body, receivedCursorIsFromViewer)

	item := map[string]any{
		"xPercent":   xPercent,
		"yPercent":   yPercent,
		"userId":     receivedMessage.Core.Header.UserId,
		"__typename": "pres_page_cursor",
	}

	browserResponseData := map[string]any{
		"id":   QueryIdPlaceholder,
		"type": "next",
		"payload": map[string]any{
			"data": map[string]any{
				"pres_page_cursor_stream": []any{
					item,
				},
			},
		},
	}
	jsonDataNext, _ := json.Marshal(browserResponseData)

	browserConnectionsToSendData := make([]*common.BrowserConnection, 0)
	browserConnectionsMutex.RLock()
	for _, bc := range browserConnections {
		bc.RLock()
		matchesMeeting := bc.MeetingId == receivedMessage.Core.Header.MeetingId
		userIsLockedViewer := matchesMeeting && bc.BBBWebSessionVariables["x-hasura-lockeduserid"] == bc.UserId
		bc.RUnlock()
		if matchesMeeting && (!cursorHiddenForLockedViewers || !userIsLockedViewer) { // check for lock settings "See other viewers cursors"
			browserConnectionsToSendData = append(browserConnectionsToSendData, bc)
		}
	}
	browserConnectionsMutex.RUnlock()

	for _, bc := range browserConnectionsToSendData {
		bc.ActiveStreamingsMutex.RLock()
		queryIds, existsCursorStream := bc.ActiveStreamings["getCursorCoordinatesStream"]
		bc.ActiveStreamingsMutex.RUnlock()
		if existsCursorStream {
			for i := range queryIds {
				payload := bytes.Replace(jsonDataNext, QueryIdPlaceholderInBytes, []byte(queryIds[i]), 1)
				bc.FromHasuraToBrowserChannel.TrySend(payload)
			}
		}
	}

	StoreCursorsCache(
		receivedMessage.Core.Header.MeetingId,
		receivedMessage.Core.Header.UserId,
		item,
	)
}

func SendPreviousCursorPosition(browserConnection *common.BrowserConnection, queryId string) {
	previousMessages, existsPreviousMessages := GetCursorsCache(browserConnection.MeetingId)
	if existsPreviousMessages {
		items := make([]any, 0, len(previousMessages))
		for _, message := range previousMessages {
			items = append(items, message)
		}

		browserResponseData := map[string]any{
			"id":   queryId,
			"type": "next",
			"payload": map[string]any{
				"data": map[string]any{
					"pres_page_cursor_stream": items,
				},
			},
		}
		jsonDataNext, _ := json.Marshal(browserResponseData)
		browserConnection.FromHasuraToBrowserChannel.SendWait(browserConnection.Context, jsonDataNext)
	}
}

// the cache will use meetingId + userId as keys, as it needs to store only the last position for each user
var (
	CursorsCache      = make(map[string]map[string]map[string]any)
	CursorsCacheMutex sync.RWMutex
)

func GetCursorsCache(meetingId string) (map[string]map[string]any, bool) {
	CursorsCacheMutex.RLock()
	defer CursorsCacheMutex.RUnlock()
	rows, ok := CursorsCache[meetingId]
	if !ok {
		return nil, false
	}
	// Deep copy the map
	copyRows := make(map[string]map[string]any, len(rows))
	for userId, row := range rows {
		newRow := make(map[string]any, len(row))
		maps.Copy(newRow, row)
		copyRows[userId] = newRow
	}

	return copyRows, true
}

func StoreCursorsCache(meetingId string, userId string, row map[string]any) {
	CursorsCacheMutex.Lock()
	defer CursorsCacheMutex.Unlock()

	if _, exists := CursorsCache[meetingId]; !exists {
		CursorsCache[meetingId] = make(map[string]map[string]any)
	}
	CursorsCache[meetingId][userId] = row
}

func RemoveMeetingCursorsCache(meetingId string) {
	CursorsCacheMutex.Lock()
	defer CursorsCacheMutex.Unlock()
	delete(CursorsCache, meetingId)
}

func RemoveUserCursorsCache(meetingId string, userId string) {
	CursorsCacheMutex.Lock()
	defer CursorsCacheMutex.Unlock()

	if _, exists := CursorsCache[meetingId]; exists {
		delete(CursorsCache[meetingId], userId)
	}
}
