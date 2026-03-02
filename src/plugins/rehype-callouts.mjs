/**
 * Rehype plugin: transforms blockquotes with [!TYPE] prefix into styled callouts.
 * Supports: NOTE, TIP, IMPORTANT, WARNING, CAUTION (GitHub/Obsidian-style)
 *
 * Usage in markdown:
 *   > [!NOTE]                     → static callout
 *   > [!NOTE] Custom Title        → custom title
 *   > [!NOTE]-                    → collapsible, closed by default
 *   > [!NOTE]+ Custom Title       → collapsible, open by default, custom title
 */
export default function rehypeCallouts() {
  return (tree) => {
    walk(tree);
  };
}

const CALLOUT_TYPES = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
const CALLOUT_RE = new RegExp(
  `^\\[!(${CALLOUT_TYPES.join('|')})\\]([+-])?\\s*(.*)`,
  'i'
);

function walk(node) {
  if (node.children) {
    for (const child of node.children) {
      walk(child);
    }
  }

  if (node.type !== 'element' || node.tagName !== 'blockquote') return;

  const firstP = node.children?.find(
    (child) => child.type === 'element' && child.tagName === 'p'
  );
  if (!firstP) return;

  const firstText = firstP.children?.find((child) => child.type === 'text');
  if (!firstText) return;

  const match = firstText.value.match(CALLOUT_RE);
  if (!match) return;

  const type = match[1].toLowerCase();
  const foldMarker = match[2] || '';      // '+', '-', or ''
  const customTitle = match[3]?.trim();   // custom title text or ''

  // Remove matched prefix from text
  firstText.value = firstText.value.slice(match[0].length);

  // Remove empty leading text nodes
  if (!firstText.value && firstP.children[0] === firstText) {
    firstP.children.shift();
    if (
      firstP.children[0] &&
      firstP.children[0].type === 'text' &&
      firstP.children[0].value.startsWith('\n')
    ) {
      firstP.children[0].value = firstP.children[0].value.slice(1);
    }
  }

  const isFoldable = foldMarker === '+' || foldMarker === '-';
  const isOpen = foldMarker === '+';
  const titleText = customTitle || type.charAt(0).toUpperCase() + type.slice(1);

  if (isFoldable) {
    // Wrap in <details><summary>…</summary>…body…</details>
    const summaryNode = {
      type: 'element',
      tagName: 'summary',
      properties: { className: ['callout-title'] },
      children: [{ type: 'text', value: titleText }]
    };

    const detailsNode = {
      type: 'element',
      tagName: 'details',
      properties: {
        className: ['callout', `callout-${type}`],
        'data-callout': type,
        ...(isOpen ? { open: true } : {})
      },
      children: [summaryNode, ...node.children]
    };

    // Replace blockquote with details element
    Object.assign(node, detailsNode);
    // Overwrite tagName & clear blockquote traits
    node.tagName = 'details';
  } else {
    // Static callout — same as before but with custom title support
    node.properties = node.properties || {};
    const existing = node.properties.className || [];
    node.properties.className = [...existing, 'callout', `callout-${type}`];
    node.properties['data-callout'] = type;

    if (customTitle) {
      node.properties['data-callout-title'] = customTitle;
    }
  }
}
