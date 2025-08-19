"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Fix default marker icons in Next.js
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow });
L.Marker.prototype.options.icon = DefaultIcon;

type GenomeRecord = {
  id: string;
  strain: string;
  organism: string;
  lat: number;
  lon: number;
};

export default function MapView({ data }: { data: GenomeRecord[] }) {
  const center = [20.5937, 78.9629]; // Center of India

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ height: "500px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {data
        .filter((d) => d.lat && d.lon)
        .map((d) => (
          <Marker key={d.id} position={[d.lat, d.lon]}>
            <Popup>
              <div>
                <strong>{d.strain}</strong>
                <br />
                {d.organism}
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
K