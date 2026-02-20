import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const published = posts.filter((p) => !p.data.draft);

  const index = published.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    date: post.data.date.toISOString().slice(0, 10),
    url: `/posts/${post.id}/`,
    body: post.body
      ?.replace(/^---[\s\S]*?---/, '')       // frontmatter
      .replace(/```[\s\S]*?```/g, '')        // code blocks
      .replace(/!\[.*?\]\(.*?\)/g, '')       // images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → text
      .replace(/[#*>`~_\-|]/g, '')           // md symbols
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000) ?? '',
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};
