export function isBlogPage(): boolean {
  if (
    document.querySelector(
      'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]',
    )
  )
    return true;

  const ogType = document.querySelector('meta[property="og:type"]');
  if (ogType?.getAttribute('content') === 'article') return true;

  if (document.querySelector('article')) return true;

  if (/\/(blog|posts?|articles?|p)\//.test(location.pathname)) return true;

  return false;
}
