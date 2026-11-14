import { useEffect } from 'react';
import { create } from 'zustand';
import { cachedLightTime, fetchCurrentLightTime, type LightTimeReading } from '@/services/horizons/live';

interface LightTimeStore {
  reading: LightTimeReading;
  loading: boolean;
  requested: boolean;
  load: () => void;
}

const useStore = create<LightTimeStore>((set, get) => ({
  reading: cachedLightTime(),
  loading: false,
  requested: false,
  load: () => {
    if (get().requested) return;
    set({ requested: true, loading: true });
    void fetchCurrentLightTime().then((reading) => set({ reading, loading: false }));
  },
}));

/** Today's Earth–Mars light time: live from JPL Horizons when reachable, otherwise the dated cache. */
export function useLightTime() {
  const { reading, loading, load } = useStore();
  useEffect(() => load(), [load]);
  return { reading, loading };
}
