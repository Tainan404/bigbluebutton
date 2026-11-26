import { type Page as PlaywrightPage, type WebSocketRoute } from '@playwright/test';

import { ELEMENT_WAIT_EXTRA_LONG_TIME } from '../core/constants';
import { routeLiveKitSignal } from '../core/livekit';
import { type ClientSettingsOverrides } from '../core/page';

// the client waits 10 s before it reconnects the graphql websocket
export const RECONNECTION_TIME = 2 * ELEMENT_WAIT_EXTRA_LONG_TIME;

// code 3001 (disconnected, reconnecting) is left out of the default showConnectionErrors
export const SHOW_RECONNECTING_TOAST: ClientSettingsOverrides = {
  public: { app: { showConnectionErrors: [3001] } },
};

export interface GraphqlSockets {
  // how many graphql websockets the page has opened so far
  opened: () => number;
  // closes the open ones, as a lost connection would, and returns how many were open;
  // the client then reconnects
  drop: () => number;
  // whether the server has sent a message containing `text` since the last drop
  receivedSinceDrop: (text: string) => boolean;
}

// Proxies the page's graphql websocket so a spec can drop it, without root, and tell
// what the server sends on the connection that replaces it. Only messages containing
// one of `watchedTexts` are tracked. Call it before the page joins the meeting.
export async function routeGraphqlSockets(page: PlaywrightPage, watchedTexts: string[]): Promise<GraphqlSockets> {
  const open = new Set<{ page: WebSocketRoute; server: WebSocketRoute }>();
  const receivedSinceDrop = new Set<string>();
  let opened = 0;

  await page.routeWebSocket(/\/graphql$/, (pageSide) => {
    const serverSide = pageSide.connectToServer();
    const socket = { page: pageSide, server: serverSide };
    open.add(socket);
    opened += 1;
    pageSide.onMessage((message) => serverSide.send(message));
    serverSide.onMessage((message) => {
      if (typeof message === 'string') {
        watchedTexts.filter((text) => message.includes(text)).forEach((text) => receivedSinceDrop.add(text));
      }
      pageSide.send(message);
    });
    pageSide.onClose(() => {
      open.delete(socket);
      serverSide.close();
    });
  });

  return {
    opened: () => opened,
    drop: () => {
      const dropped = open.size;
      receivedSinceDrop.clear();
      open.forEach((socket) => {
        socket.page.close({ code: 1001, reason: 'connection dropped by the test' });
        socket.server.close();
      });
      open.clear();
      return dropped;
    },
    receivedSinceDrop: (text: string) => receivedSinceDrop.has(text),
  };
}

export interface ServerConnection {
  // closes the page's graphql and LiveKit signal sockets, as a network drop would, and
  // returns how many of each were open; the client reconnects on new ones
  drop: () => { graphql: number; liveKitSignal: number };
}

// Cuts the page's connection to the server from inside the browser: no root needed, and
// other pages and workers keep theirs. Call it before the page joins the meeting.
export async function routeServerConnection(page: PlaywrightPage): Promise<ServerConnection> {
  const graphqlSockets = await routeGraphqlSockets(page, []);
  const liveKitSignal = await routeLiveKitSignal(page);

  return {
    drop: () => ({ graphql: graphqlSockets.drop(), liveKitSignal: liveKitSignal.drop() }),
  };
}

// Sustained full outage toward the server: drop TCP:443 for `seconds` while
// repeatedly killing established sockets, then restore. A brief (1 s) cut like
// killConnection() lets the signaling websockets recover before the camera peers
// tear down; the webcam-background reproduction needs those peers to be destroyed
// and rebuilt, which requires an outage long enough to close their sockets. Like
// killConnection(), this needs workstation sudo and severs ALL local connections
// to the server, so specs using it must run standalone (--workers=1).
export async function severConnection(seconds = 5) {
  if (!hostname) {
    throw new Error('hostname is undefined; ensure BBB_URL is set');
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    throw new Error(`Invalid hostname format: ${hostname}`);
  }
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 60) {
    throw new Error(`severConnection: seconds must be an integer in 1..60, got ${seconds}`);
  }

  try {
    await exec(`sudo iptables -A OUTPUT -p tcp -d ${hostname} --dport 443 -j DROP`);
    for (let i = 0; i < seconds; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await exec(`sudo ss -K dst ${hostname} dport https || true; sleep 1`);
    }
  } finally {
    await exec(`sudo iptables -D OUTPUT -p tcp -d ${hostname} --dport 443 -j DROP`);
  }
}
