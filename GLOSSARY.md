# call-ma

Peer-to-peer video calls between two browsers, without any server of our own.

## Language

**Room**:
A meeting place for two peers inside a Transport, identified by the room ID in the shared link.
_Avoid_: conference, channel, session

**Transport**:
A signaling channel through which peers find each other in a Room: MQTT, BitTorrent, Nostr or IPFS. Several Transports race; the first to connect a peer wins.
_Avoid_: strategy (Trystero's word), provider, backend

**Relay**:
A third-party server a Transport talks through: an MQTT broker, a BitTorrent tracker, a Nostr relay.
_Avoid_: broker or tracker as the general term, signaling server

**ICE servers**:
The STUN and TURN servers a peer uses to discover and traverse NAT. One list serves every way of connecting.
_Avoid_: STUN servers (when TURN is included), RTC config

**Direct mode**:
Connecting without any Transport: the SDP offer and answer travel inside links or QR codes that people pass by hand.
_Avoid_: manual mode, serverless fallback, QR mode
