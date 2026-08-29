import type { LatLng } from '@/utils/geo';

export type BoundaryMapProps = {
  points: LatLng[];
  /** Optional initial centre coordinate for the camera. */
  initialCentre?: LatLng | null;
  /** Optional initial zoom level (default ~16.5). */
  initialZoom?: number;
  /** Omit both handlers to render a read-only preview. */
  onAddPoint?: (point: LatLng) => void;
  onMovePoint?: (index: number, point: LatLng) => void;
  /** Fires once the native map has finished loading its style/tiles. */
  onReady?: () => void;
  /** Fires when tile loading or map style fails. */
  onError?: () => void;
  editable?: boolean;
  /** Shows the device's live position puck. Off by default. */
  showsUserLocation?: boolean;
};
