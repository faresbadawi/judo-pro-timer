// Künstliche Uhr für Tests: Zeit wird von Hand vorgestellt.
export function fakeClock(start = 1000) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; }, wall: () => 1_700_000_000_000 + t };
}
