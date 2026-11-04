import { joinRoom as mqttJoinRoom }    from '@trystero-p2p/mqtt';
import { joinRoom as torrentJoinRoom } from '@trystero-p2p/torrent';
import { joinRoom as nostrJoinRoom }   from '@trystero-p2p/nostr';
import { joinRoom as ipfsJoinRoom }    from '@trystero-p2p/ipfs';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';
import { getConnectionConfig } from './shared/config/connection.js';

initPwa();

const searchParams = new URLSearchParams(globalThis.location.search);
const { iceServers, mqttRelayUrls, torrentRelayUrls } = getConnectionConfig({ env: import.meta.env, searchParams });

initApp({
  document: globalThis.document,
  window: globalThis.window,
  navigator: globalThis.navigator,
  iceServers,
  transports: [
    { joinRoom: mqttJoinRoom,    relayUrls: mqttRelayUrls },
    { joinRoom: torrentJoinRoom, relayUrls: torrentRelayUrls },
    { joinRoom: nostrJoinRoom },
    { joinRoom: ipfsJoinRoom },
  ],
});
