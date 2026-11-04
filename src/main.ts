import { joinRoom as ipfsJoinRoom }    from '@trystero-p2p/ipfs';
import { joinRoom as mqttJoinRoom }    from '@trystero-p2p/mqtt';
import { joinRoom as nostrJoinRoom }   from '@trystero-p2p/nostr';
import { joinRoom as torrentJoinRoom } from '@trystero-p2p/torrent';

import { initApp } from './app/controller.ts';
import { initPwa } from './pwa.ts';
import { getConnectionConfig } from './shared/config/connection.ts';

initPwa();

const searchParams = new URLSearchParams(location.search);
const { iceServers, mqttRelayUrls, torrentRelayUrls } = getConnectionConfig({ env: import.meta.env, searchParams });

initApp({
  document,
  window: globalThis,
  navigator,
  iceServers,
  transports: [
    { joinRoom: mqttJoinRoom,    relayUrls: mqttRelayUrls },
    { joinRoom: torrentJoinRoom, relayUrls: torrentRelayUrls },
    { joinRoom: nostrJoinRoom },
    { joinRoom: ipfsJoinRoom },
  ],
});
