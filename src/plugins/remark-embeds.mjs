/**
 * Remark plugin: transforms ![[embeds]] into rich content.
 * Supports:
 *   ![[note-name]]           → internal note embed card (link card to the post)
 *   ![[image.png]]           → <img> tag
 *   ![[https://example.com]] → external link card with OGP metadata
 *
 * Web URL embeds fetch og:title, og:description, og:image at build time.
 */
import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico'];

/**
 * Build basename → full post ID map (same logic as wikilinks)
 */
function buildFileMap(postsDir) {
  const map = new Map();
  const root = path.resolve(postsDir);

  function scan(dir, prefix = '') {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        scan(path.join(dir, entry.name), prefix ? `${prefix}/${entry.name}` : entry.name);
      } else if (entry.name.endsWith('.md')) {
        const basename = entry.name.replace(/\.md$/, '');
        const id = prefix ? `${prefix}/${basename}` : basename;
        map.set(basename.toLowerCase(), { id, title: basename });
        map.set(id.toLowerCase(), { id, title: basename });
      }
    }
  }

  scan(root);
  return map;
}

/**
 * Try to extract the title from a markdown file's frontmatter
 */
function extractTitle(postsDir, postId) {
  const filePath = path.resolve(postsDir, `${postId}.md`);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---[\s\S]*?title:\s*(.+)/m);
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
  } catch {
    return null;
  }
}

/**
 * Fetch OGP metadata from a URL at build time.
 * Returns { title, description, image, favicon } or defaults.
 */
async function fetchOgpData(url) {
  const defaults = {
    title: new URL(url).hostname,
    description: url,
    image: null,
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AstroBlog/1.0)' }
    });
    clearTimeout(timeout);

    if (!res.ok) return defaults;

    const html = await res.text();

    const getMetaContent = (property) => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
      ];
      for (const re of patterns) {
        const m = html.match(re);
        if (m) return m[1];
      }
      return null;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

    return {
      title: getMetaContent('og:title') || (titleMatch ? titleMatch[1].trim() : defaults.title),
      description: getMetaContent('og:description') || getMetaContent('description') || defaults.description,
      image: getMetaContent('og:image') || null,
      favicon: defaults.favicon
    };
  } catch {
    return defaults;
  }
}

/**
 * Check if string is a URL
 */
function isUrl(str) {
  return /^https?:\/\//.test(str);
}

/**
 * Check if string refers to an image file
 */
function isImage(str) {
  const ext = path.extname(str).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export default function remarkEmbeds(options = {}) {
  const postsDir = options.postsDir || './src/content/posts';
  const fileMap = buildFileMap(postsDir);

  // Collect all web URLs for batch fetching
  return async (tree) => {
    const embedNodes = [];

    // First pass: find all embed patterns
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;

      const embedRegex = /!\[\[([^\]]+?)\]\]/g;
      const matches = [...node.value.matchAll(embedRegex)];

      if (matches.length === 0) return;

      embedNodes.push({ node, index, parent, matches });
    });

    // Collect URLs that need fetching
    const urlsToFetch = new Map();
    for (const { matches } of embedNodes) {
      for (const match of matches) {
        const target = match[1].trim();
        if (isUrl(target) && !urlsToFetch.has(target)) {
          urlsToFetch.set(target, null);
        }
      }
    }

    // Fetch all OGP data in parallel
    if (urlsToFetch.size > 0) {
      const entries = [...urlsToFetch.keys()];
      const results = await Promise.all(entries.map((url) => fetchOgpData(url)));
      entries.forEach((url, i) => urlsToFetch.set(url, results[i]));
    }

    // Second pass: replace nodes (process in reverse to keep indices valid)
    for (const { node, index, parent, matches } of embedNodes.reverse()) {
      const value = node.value;
      const newChildren = [];
      let lastIndex = 0;

      for (const match of matches) {
        const fullMatch = match[0];
        const target = match[1].trim();
        const matchStart = match.index;

        // Text before match
        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: value.slice(lastIndex, matchStart) });
        }

        if (isUrl(target)) {
          // Web URL embed → link card
          const ogp = urlsToFetch.get(target) || { title: target, description: target, image: null, favicon: null };
          newChildren.push(buildWebLinkCard(target, ogp));
        } else if (isImage(target)) {
          // Image embed
          newChildren.push({
            type: 'image',
            url: target.startsWith('/') ? target : `/${target}`,
            alt: path.basename(target, path.extname(target)),
            data: { hProperties: { className: ['embed-image'] } }
          });
        } else {
          // Internal note embed → link card
          const resolved = fileMap.get(target.toLowerCase());
          if (resolved) {
            const title = extractTitle(postsDir, resolved.id) || resolved.title;
            newChildren.push(buildInternalCard(resolved.id, title));
          } else {
            // Unresolved embed → show as broken embed
            newChildren.push({
              type: 'html',
              value: `<div class="embed-card embed-card-missing"><span class="embed-card-title">📄 ${escapeHtml(target)}</span><span class="embed-card-desc">페이지를 찾을 수 없습니다</span></div>`
            });
          }
        }

        lastIndex = matchStart + fullMatch.length;
      }

      // Remaining text
      if (lastIndex < value.length) {
        newChildren.push({ type: 'text', value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...newChildren);
    }
  };
}

function buildWebLinkCard(url, ogp) {
  const hostname = new URL(url).hostname;
  const imageHtml = ogp.image
    ? `<img class="embed-link-card-image" src="${escapeHtml(ogp.image)}" alt="" loading="lazy" />`
    : '';

  return {
    type: 'html',
    value: `<a href="${escapeHtml(url)}" class="embed-link-card" target="_blank" rel="noopener noreferrer">
  <div class="embed-link-card-body">
    <span class="embed-link-card-title">${escapeHtml(ogp.title)}</span>
    <span class="embed-link-card-desc">${escapeHtml(ogp.description)}</span>
    <span class="embed-link-card-url"><img class="embed-link-card-favicon" src="${escapeHtml(ogp.favicon)}" alt="" width="14" height="14" />${escapeHtml(hostname)}</span>
  </div>
  ${imageHtml}
</a>`
  };
}

function buildInternalCard(postId, title) {
  return {
    type: 'html',
    value: `<a href="/posts/${escapeHtml(postId)}/" class="embed-card embed-card-internal">
  <span class="embed-card-icon">📄</span>
  <span class="embed-card-title">${escapeHtml(title)}</span>
</a>`
  };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
