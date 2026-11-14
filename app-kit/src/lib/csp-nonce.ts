/**
 * The CSP nonce the document publishes in `<meta property="csp-nonce">`, for
 * style elements created after page load. Browsers hide the parsed attribute
 * and keep the value on the `nonce` property; DOMs without that property keep
 * only the attribute. Returns `undefined` when the document has no such meta.
 */
export function cspNonce(): string | undefined {
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[property="csp-nonce"]',
  );
  if (meta?.nonce) return meta.nonce;
  const attribute = meta?.getAttribute('nonce');
  if (attribute) return attribute;
  return undefined;
}
