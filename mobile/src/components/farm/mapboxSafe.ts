let MapboxModule: any = null;
let isMapboxAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = require('@rnmapbox/maps');
  const mod = raw?.default ? { ...raw, ...raw.default } : raw;
  if (mod && (mod.MapView || mod.setAccessToken)) {
    isMapboxAvailable = true;
    MapboxModule = mod;
  }
} catch {
  isMapboxAvailable = false;
  MapboxModule = null;
}

export const Mapbox = MapboxModule;
export const isNativeMapboxAvailable = isMapboxAvailable;

export const Camera = MapboxModule?.Camera ?? MapboxModule?.default?.Camera;
export const FillLayer = MapboxModule?.FillLayer ?? MapboxModule?.default?.FillLayer;
export const LineLayer = MapboxModule?.LineLayer ?? MapboxModule?.default?.LineLayer;
export const LocationPuck = MapboxModule?.LocationPuck ?? MapboxModule?.default?.LocationPuck;
export const MapView = MapboxModule?.MapView ?? MapboxModule?.default?.MapView;
export const PointAnnotation = MapboxModule?.PointAnnotation ?? MapboxModule?.default?.PointAnnotation;
export const ShapeSource = MapboxModule?.ShapeSource ?? MapboxModule?.default?.ShapeSource;
export const StyleURL = MapboxModule?.StyleURL ?? MapboxModule?.default?.StyleURL ?? {
  SatelliteStreet: 'mapbox://styles/mapbox/satellite-streets-v12',
  Outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};
