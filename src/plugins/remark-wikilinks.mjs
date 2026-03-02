/**
 * Remark plugin: transforms [[wikilinks]] into <a> tags.
 * Supports:
 *   [[page-name]]         → link to /posts/{resolved-id}/
 *   [[page-name|alias]]   → link text = alias
 *
 * Resolves file-name to full post ID by scanning ./src/content/posts at build time.
 * Unresolved links get class "wiki-link new".
 */
import { visit } from 'unist-util-visit';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Build a map of basename (without .md) → full post ID (relative path without .md)
 * e.g. "performance" → "notes/performance", "getting-started" → "getting-started"
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
        // If there are duplicates, the last one wins — could warn in future
        map.set(basename.toLowerCase(), id);
        // Also store full id as key for exact matches like [[notes/performance]]
        map.set(id.toLowerCase(), id);
      }
    }
  }

  scan(root);
  return map;
}

export default function remarkWikilinks(options = {}) {
  const postsDir = options.postsDir || './src/content/posts';
  const base = options.base ? options.base.replace(/\/$/, '') + '/' : '/';
  const fileMap = buildFileMap(postsDir);

  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || index === null || index === undefined) return;

      // Match [[target]] or [[target|alias]] — but NOT ![[...]] (embeds)
      const wikiLinkRegex = /(?<!!)\[\[([^\]]+?)\]\]/g;
      const value = node.value;
      const matches = [...value.matchAll(wikiLinkRegex)];

      if (matches.length === 0) return;

      const newChildren = [];
      let lastIndex = 0;

      for (const match of matches) {
        const fullMatch = match[0];
        const inner = match[1];
        const matchStart = match.index;

        // Text before the match
        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: value.slice(lastIndex, matchStart) });
        }

        // Parse target and optional alias
        const pipeIdx = inner.indexOf('|');
        const target = pipeIdx >= 0 ? inner.slice(0, pipeIdx).trim() : inner.trim();
        const alias = pipeIdx >= 0 ? inner.slice(pipeIdx + 1).trim() : target;

        // Resolve the target to a post ID
        const resolved = fileMap.get(target.toLowerCase());
        const href = resolved ? `${base}posts/${resolved}/` : '#';
        const classes = resolved ? ['wiki-link'] : ['wiki-link', 'new'];

        newChildren.push({
          type: 'link',
          url: href,
          data: {
            hProperties: { className: classes }
          },
          children: [{ type: 'text', value: alias }]
        });

        lastIndex = matchStart + fullMatch.length;
      }

      // Remaining text after last match
      if (lastIndex < value.length) {
        newChildren.push({ type: 'text', value: value.slice(lastIndex) });
      }

      // Replace the text node with the new children
      parent.children.splice(index, 1, ...newChildren);
    });
  };
}
