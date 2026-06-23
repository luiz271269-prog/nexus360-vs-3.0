import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Ajusta automaticamente o zoom/centro do mapa para enquadrar apenas
 * os pontos onde existem clientes. Assim o mapa foca na região onde há
 * cadastro (ex: Sul do Brasil) e se adapta caso haja clientes em outras UFs.
 */
export default function AjustarLimitesMapa({ pontos }) {
  const map = useMap();

  useEffect(() => {
    if (!pontos || pontos.length === 0) return;
    const coords = pontos.map((p) => p.coord).filter(Boolean);
    if (coords.length === 0) return;

    if (coords.length === 1) {
      map.setView(coords[0], 9);
      return;
    }

    map.fitBounds(coords, { padding: [40, 40], maxZoom: 10 });
  }, [pontos, map]);

  return null;
}