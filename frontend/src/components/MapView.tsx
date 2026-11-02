import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MarkerKind = "incident" | "sos" | "shelter" | "quake" | "place";
export interface MapMarker {
  id: string; lat: number; lng: number; label: string; detail?: string;
  lines?: string[];
  severity?: "critical" | "high" | "moderate" | "low" | "safe";
  kind?: MarkerKind;
}
const colors: Record<string, string> = { critical: "#dc2626", high: "#ea580c", moderate: "#d97706", low: "#0284c7", safe: "#059669" };
const symbols: Record<MarkerKind, string> = { incident: "!", sos: "S", shelter: "⌂", quake: "◎", place: "⌖" };
function pinIcon(m: MapMarker) {
  const bg = colors[m.severity ?? "low"];
  const symbol = symbols[m.kind ?? "incident"];
  return L.divIcon({ className: "", html: `<div class="map-pin" style="background:${bg}" title="${m.label.replace(/"/g, "")}">${symbol}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}
function FocusController({ focus }: { focus?: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => { if (focus) map.setView([focus.lat, focus.lng], focus.zoom ?? 12); }, [focus, map]);
  return null;
}
function RouteFitter({ line }: { line?: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (line && line.length > 1) map.fitBounds(L.latLngBounds(line.map(([lat, lng]) => [lat, lng] as [number, number])), { padding: [24, 24] });
  }, [line, map]);
  return null;
}
export default function MapView({ markers, center, zoom = 12, height = 340, focus, routeLine }: { markers: MapMarker[]; center?: [number, number]; zoom?: number; height?: number; focus?: { lat: number; lng: number; zoom?: number } | null; routeLine?: [number, number][] | null }) {
  const c: [number, number] = center ?? (markers.length ? [markers[0].lat, markers[0].lng] : [28.62, 77.21]);
  return (
    <div style={{ height }} role="img" aria-label="Map showing incident, SOS and shelter locations">
      <MapContainer center={c} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FocusController focus={focus} />
        <RouteFitter line={routeLine} />
        {routeLine && routeLine.length > 1 && <Polyline positions={routeLine} pathOptions={{ color: "#b91c1c", weight: 4, opacity: 0.85 }} />}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(m)}>
            <Popup>
              <strong>{m.label}</strong>
              {m.detail && <><br />{m.detail}</>}
              {m.lines?.map((line) => <div key={line}>{line}</div>)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
