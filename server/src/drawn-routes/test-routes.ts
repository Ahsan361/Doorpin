import type { DrawnRouteInput, LatLng } from '@doorpin/shared';

/** A point `northM` meters north and `eastM` meters east of a spot in Islamabad. */
export function at(northM: number, eastM: number): LatLng {
  const lat = 33.66;
  return {
    lat: lat + northM / 111_320,
    lng: 73.08 + eastM / (111_320 * Math.cos((lat * Math.PI) / 180)),
  };
}

/** A valid route: entry point at (0, 0), house end at (50, 200), door about 14 m beyond it. */
export function sampleRoute(): DrawnRouteInput {
  return {
    title: 'House 12, Street 4',
    door: at(60, 210),
    path: [at(0, 0), at(0, 200), at(50, 200)],
    landmarks: [
      { position: at(5, 150), note: 'Turn left at the green gate' },
      { position: at(5, 50), note: 'Pass the mosque' },
    ],
  };
}
