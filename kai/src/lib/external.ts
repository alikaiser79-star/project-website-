/* No-key public APIs — used by the IntelStrip. Both have CORS enabled. */

export type WeatherSnap = {
  tempC: number;
  feelsC: number;
  wind: number;
  code: number;
  label: string;
  isDay: boolean;
};

const WMO_LABELS: Record<number, string> = {
  0: 'clear', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'fog', 48: 'rime fog',
  51: 'drizzle', 53: 'drizzle', 55: 'drizzle',
  61: 'rain', 63: 'rain', 65: 'heavy rain',
  71: 'snow', 73: 'snow', 75: 'snow',
  80: 'showers', 81: 'showers', 82: 'showers',
  95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
};

export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnap> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,is_day,weather_code,wind_speed_10m`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather ' + res.status);
  const j = await res.json();
  const c = j.current ?? {};
  return {
    tempC: c.temperature_2m,
    feelsC: c.apparent_temperature,
    wind: c.wind_speed_10m,
    code: c.weather_code,
    label: WMO_LABELS[c.weather_code] ?? 'unknown',
    isDay: !!c.is_day,
  };
}

export type MarketTick = { id: string; symbol: string; price: number; change24: number };

export type PrayerSnap = {
  byName: Record<string, string>;  // "Fajr" → "04:18"
  nextName: string;
  nextAt: Date;
};

export async function fetchPrayer(lat: number, lon: number): Promise<PrayerSnap> {
  /* Aladhan: method 5 = Egyptian General Authority of Survey. */
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('prayer ' + res.status);
  const j = await res.json();
  const t = j?.data?.timings || {};
  const want = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const byName: Record<string, string> = {};
  for (const k of want) if (t[k]) byName[k] = String(t[k]).slice(0, 5);

  const now = new Date();
  let nextName = '', nextAt: Date | null = null;
  for (const k of want) {
    if (k === 'Sunrise') continue;
    const hhmm = byName[k];
    if (!hhmm) continue;
    const [h, m] = hhmm.split(':').map(Number);
    const cand = new Date(now); cand.setHours(h, m, 0, 0);
    if (+cand > +now && (!nextAt || +cand < +nextAt)) { nextAt = cand; nextName = k; }
  }
  if (!nextAt) {
    // After Isha → next prayer is Fajr tomorrow
    const [h, m] = byName['Fajr'].split(':').map(Number);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(h, m, 0, 0);
    nextName = 'Fajr'; nextAt = tomorrow;
  }
  return { byName, nextName, nextAt };
}

export async function fetchMarkets(): Promise<MarketTick[]> {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana' +
    '&vs_currencies=usd&include_24hr_change=true';
  const res = await fetch(url);
  if (!res.ok) throw new Error('markets ' + res.status);
  const j = await res.json();
  const map: Array<[string, string]> = [
    ['bitcoin', 'BTC'], ['ethereum', 'ETH'], ['solana', 'SOL'],
  ];
  return map.map(([id, sym]) => ({
    id,
    symbol: sym,
    price: j[id]?.usd ?? 0,
    change24: j[id]?.usd_24h_change ?? 0,
  }));
}
