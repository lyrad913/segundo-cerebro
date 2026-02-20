import { getCollection, type CollectionEntry } from 'astro:content';

export type PostEntry = CollectionEntry<'posts'>;

export interface PostItem {
  id: string;
  title: string;
  category: string;
  tags: string[];
  date: Date;
  description: string;
  url: string;
}

export const slugifyTag = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]/g, '');

export async function getPublishedPosts(): Promise<PostEntry[]> {
  const all = await getCollection('posts');
  return all
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function toPostItems(posts: PostEntry[]): PostItem[] {
  return posts.map((post) => ({
    id: post.id,
    title: post.data.title,
    category: post.data.category,
    tags: post.data.tags,
    date: post.data.date,
    description: post.data.description,
    url: `/posts/${post.id}/`
  }));
}

export function buildCountMap(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
