/**
 * Rehype plugin: transforms blockquotes with [!TYPE] prefix into styled callouts.
 * Supports: NOTE, TIP, IMPORTANT, WARNING, CAUTION (GitHub-style)
 *
 * Usage in markdown:
 *   > [!NOTE]
 *   > This is a note
 */
export default function rehypeCallouts() {
  return (tree) => {
    walk(tree);
  };
}

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

  const match = firstText.value.match(
    /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i
  );
  if (!match) return;

  const type = match[1].toLowerCase();
  firstText.value = firstText.value.slice(match[0].length);

  // Remove empty leading text nodes
  if (!firstText.value && firstP.children[0] === firstText) {
    firstP.children.shift();
    // Also strip leading linebreak
    if (
      firstP.children[0] &&
      firstP.children[0].type === 'text' &&
      firstP.children[0].value.startsWith('\n')
    ) {
      firstP.children[0].value = firstP.children[0].value.slice(1);
    }
  }

  node.properties = node.properties || {};
  const existing = node.properties.className || [];
  node.properties.className = [...existing, 'callout', `callout-${type}`];
  node.properties['data-callout'] = type;
}
