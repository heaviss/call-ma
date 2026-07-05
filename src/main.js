import { joinRoom as mqttJoinRoom }    from '@trystero-p2p/mqtt';
import { joinRoom as torrentJoinRoom } from '@trystero-p2p/torrent';
import { joinRoom as nostrJoinRoom }   from '@trystero-p2p/nostr';
import { joinRoom as ipfsJoinRoom }    from '@trystero-p2p/ipfs';
import { initPwa } from './pwa.js';
import { initApp } from './app/controller.js';
import { getMqttRelayUrls, getTorrentRelayUrls } from './shared/config/relays.js';

initPwa();

if (globalThis.window !== undefined && globalThis.document !== undefined) {
  try {
    const searchParams = new URLSearchParams(globalThis.window.location.search);
    const transports = [
      { joinRoom: mqttJoinRoom,    relayUrls: getMqttRelayUrls(undefined, searchParams) },
      { joinRoom: torrentJoinRoom, relayUrls: getTorrentRelayUrls(undefined, searchParams) },
      { joinRoom: nostrJoinRoom },
      { joinRoom: ipfsJoinRoom },
    ];
    initApp({ document: globalThis.document, window: globalThis.window, navigator: globalThis.navigator, transports });
  } catch {}
}
