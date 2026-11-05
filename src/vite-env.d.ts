// Build-time env read by src/shared/config/connection.ts (see README "Configuration").
interface ImportMetaEnv {
  readonly VITE_STUN_SERVERS?: string;
  readonly VITE_MQTT_RELAYS?: string;
  readonly VITE_TORRENT_TRACKERS?: string;
  readonly VITE_TURN_URL?: string;
  readonly VITE_TURN_USER?: string;
  readonly VITE_TURN_PASS?: string;
}
