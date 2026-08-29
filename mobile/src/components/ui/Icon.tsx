import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * The prototype uses a single outline icon set at 1.8–2 stroke width on a
 * 24×24 grid. These paths are lifted directly from `Farmer App.dc.html` so the
 * app matches the design exactly — never mix in a second icon set.
 */
export type IconName =
  | 'home'
  | 'field'
  | 'market'
  | 'history'
  | 'mic'
  | 'back'
  | 'close'
  | 'alert'
  | 'clock'
  | 'plant'
  | 'sun'
  | 'chevron'
  | 'check'
  | 'globe'
  | 'bell'
  | 'help'
  | 'logout'
  | 'pin'
  | 'undo'
  | 'restart'
  | 'offline'
  | 'map'
  | 'book'
  | 'droplet'
  | 'flask'
  | 'play'
  | 'camera'
  | 'phone'
  | 'mail';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 20, color = colors.text.secondary, strokeWidth = 1.8 }: Props) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...common} />
          <Path d="M9 21v-8h6v8" {...common} />
        </>
      )}
      {name === 'field' && (
        <>
          <Path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" {...common} />
          <Path d="M9 3v15" {...common} />
          <Path d="M15 6v15" {...common} />
        </>
      )}
      {name === 'market' && (
        <>
          <Path d="M3 17l5-6 4 3 5-7 4 4" {...common} />
          <Path d="M3 21h18" {...common} />
        </>
      )}
      {(name === 'history' || name === 'clock') && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M12 7v5l3 2" {...common} />
        </>
      )}
      {name === 'mic' && (
        <>
          <Rect x="9" y="2" width="6" height="11" rx="3" {...common} />
          <Path d="M5 11a7 7 0 0 0 14 0" {...common} />
          <Path d="M12 18v3" {...common} />
        </>
      )}
      {name === 'back' && (
        <>
          <Path d="m12 19-7-7 7-7" {...common} />
          <Path d="M19 12H5" {...common} />
        </>
      )}
      {name === 'close' && (
        <>
          <Path d="M18 6 6 18" {...common} />
          <Path d="m6 6 12 12" {...common} />
        </>
      )}
      {name === 'alert' && (
        <>
          <Path d="M12 9v4" {...common} />
          <Path d="M12 17h.01" {...common} />
          <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" {...common} />
        </>
      )}
      {name === 'plant' && (
        <>
          <Path d="M7 20h10" {...common} />
          <Path d="M12 20V9" {...common} />
          <Path d="M12 9C12 5.5 9.5 3 6 3c0 3.5 2.5 6 6 6z" {...common} />
          <Path d="M12 9c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z" {...common} />
        </>
      )}
      {name === 'sun' && (
        <>
          <Path d="M12 2v2" {...common} />
          <Path d="M12 20v2" {...common} />
          <Path d="m4.9 4.9 1.4 1.4" {...common} />
          <Path d="m17.7 17.7 1.4 1.4" {...common} />
          <Path d="M2 12h2" {...common} />
          <Path d="M20 12h2" {...common} />
          <Path d="m6.3 17.7-1.4 1.4" {...common} />
          <Path d="m19.1 4.9-1.4 1.4" {...common} />
          <Circle cx="12" cy="12" r="4" {...common} />
        </>
      )}
      {name === 'chevron' && <Path d="m9 6 6 6-6 6" {...common} />}
      {name === 'check' && <Path d="M20 6 9 17l-5-5" {...common} />}
      {name === 'globe' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M3 12h18" {...common} />
          <Path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" {...common} />
          <Path d="M13.7 21a2 2 0 0 1-3.4 0" {...common} />
        </>
      )}
      {name === 'help' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" {...common} />
          <Path d="M12 17h.01" {...common} />
        </>
      )}
      {name === 'logout' && (
        <>
          <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...common} />
          <Path d="m16 17 5-5-5-5" {...common} />
          <Path d="M21 12H9" {...common} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" {...common} />
          <Circle cx="12" cy="10" r="3" {...common} />
        </>
      )}
      {name === 'undo' && (
        <>
          <Path d="M3 7v6h6" {...common} />
          <Path d="M3 13a9 9 0 1 0 3-7.7L3 8" {...common} />
        </>
      )}
      {name === 'restart' && (
        <>
          <Path d="M21 12a9 9 0 1 1-3-6.7" {...common} />
          <Path d="M21 3v6h-6" {...common} />
        </>
      )}
      {name === 'offline' && (
        <>
          <Path d="M12 20h.01" {...common} />
          <Path d="M8.5 16.4a5 5 0 0 1 7 0" {...common} />
          <Path d="M5 12.9a10 10 0 0 1 3-2" {...common} />
          <Path d="m2 2 20 20" {...common} />
          <Path d="M16.8 13.8A10 10 0 0 1 19 12.9" {...common} />
        </>
      )}
      {name === 'map' && (
        <>
          <Path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" {...common} />
          <Path d="M9 4v14" {...common} />
          <Path d="M15 6v14" {...common} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" {...common} />
          <Path d="M4 5.5v15" {...common} />
          <Path d="M8 8h8" {...common} />
          <Path d="M8 12h8" {...common} />
        </>
      )}
      {name === 'droplet' && (
        <Path d="M12 2s7 8.5 7 13a7 7 0 0 1-14 0c0-4.5 7-13 7-13z" {...common} />
      )}
      {name === 'flask' && (
        <>
          <Path d="M9 2h6" {...common} />
          <Path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2" {...common} />
          <Path d="M6.5 15h11" {...common} />
        </>
      )}
      {name === 'play' && (
        <>
          <Circle cx="12" cy="12" r="9" {...common} />
          <Path d="M10 8.5v7l6-3.5z" {...common} />
        </>
      )}
      {name === 'camera' && (
        <>
          <Path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" {...common} />
          <Circle cx="12" cy="13" r="3.5" {...common} />
        </>
      )}
      {name === 'phone' && (
        <Path
          d="M6.6 10.8c1.2 2.4 3.2 4.4 5.6 5.6l1.9-1.9c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V19c0 .6-.4 1-1 1C10.7 20 4 13.3 4 5c0-.6.4-1 1-1h3.1c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.3 1z"
          {...common}
        />
      )}
      {name === 'mail' && (
        <>
          <Rect x="3" y="5" width="18" height="14" rx="2" {...common} />
          <Path d="m4 7 8 6 8-6" {...common} />
        </>
      )}
    </Svg>
  );
}
