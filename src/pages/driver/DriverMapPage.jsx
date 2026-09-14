import { useEffect, useMemo, useState } from 'react';
import { LiveMap } from '../../components/delivery/LiveMap';
import { getMyDriverSummary } from '../../services/driverService';
import { listLiveLocations } from '../../services/trackingService';
import { DEFAULT_MAP_CENTER } from '../../utils/geo';

export function DriverMapPage() {
  const [summary, setSummary] = useState(null);
  const [myLoc, setMyLoc] = useState(null);
  const [styleId, setStyleId] = useState('streets');

  useEffect(() => {
    const load = async () => {
      const s = await getMyDriverSummary().catch(() => null);
      setSummary(s);
      const locs = await listLiveLocations().catch(() => []);
      const mine = locs.find((l) => l.driver_id === s?.driver?.id);
      if (mine) setMyLoc(mine);
    };
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  const active = summary?.activeAssignments?.[0];
  const job = active?.ep_delivery_jobs;

  const markers = useMemo(() => {
    const list = [];
    if (myLoc) {
      list.push({
        id: 'me',
        lat: myLoc.lat,
        lng: myLoc.lng,
        label: 'Tú',
        color: '#f97316',
        kind: 'driver',
      });
    }
    if (job?.customer_lat) {
      list.push({
        id: 'customer',
        lat: job.customer_lat,
        lng: job.customer_lng,
        label: job.customer_name,
        color: '#c00000',
        kind: 'customer',
      });
    }
    return list;
  }, [myLoc, job]);

  const routes = useMemo(() => {
    if (!myLoc || !job?.customer_lat) return [];
    return [{
      id: 'active',
      from: { lat: myLoc.lat, lng: myLoc.lng },
      to: { lat: job.customer_lat, lng: job.customer_lng },
      color: '#c00000',
    }];
  }, [myLoc, job]);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col p-2">
      <LiveMap
        className="h-full flex-1"
        center={myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : DEFAULT_MAP_CENTER}
        markers={markers}
        routes={routes}
        styleId={styleId}
        onStyleChange={setStyleId}
        followId="me"
      />
    </div>
  );
}
