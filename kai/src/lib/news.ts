/* Hacker News top stories — keyless, CORS-friendly. */

export type Story = { id: number; title: string; url?: string; by?: string };

let cache: { at: number; items: Story[] } | null = null;

export async function fetchTopStories(n = 8): Promise<Story[]> {
  if (cache && Date.now() - cache.at < 15 * 60_000) return cache.items;
  const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  if (!idsRes.ok) throw new Error('hn ids ' + idsRes.status);
  const ids: number[] = await idsRes.json();
  const top = ids.slice(0, n);
  const items = await Promise.all(top.map(async (id) => {
    const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.dead || j.deleted) return null;
    return { id: j.id, title: j.title, url: j.url, by: j.by } as Story;
  }));
  const cleaned = items.filter((x): x is Story => !!x);
  cache = { at: Date.now(), items: cleaned };
  return cleaned;
}
