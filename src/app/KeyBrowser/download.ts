/**
 * Hands the browser a file to save.
 *
 * <p>An object URL and a synthetic click, because there is no other way: the file is built in the
 * page from data the application already has, so there is nothing to link to. The URL is revoked
 * immediately after — it holds the blob alive for as long as it exists, and an export of a large
 * keyspace is a large blob.
 */
export const saveAsFile = (filename: string, contents: string, type = 'application/json'): void => {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

/**
 * A name that says which target the file came from and when.
 *
 * <p>Everything not safe in a filename becomes a dash: a connection may be named anything, and a
 * profile called "prod/eu-west" would otherwise produce a path rather than a name.
 */
export const exportFilename = (connectionName: string, at: Date): string => {
  const safe = connectionName.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'keydra';
  const stamp = at.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${safe}-keys-${stamp}.json`;
};
