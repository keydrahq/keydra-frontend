/**
 * Types for the browser entry of `qrcode`.
 *
 * <p>`@types/qrcode` describes the package's main entry, which is the Node one — the build that
 * reaches for `fs` to write a PNG. The browser build is a subset of it, and this declares the part
 * of that subset Keydra uses rather than restating the whole surface.
 */
declare module 'qrcode/lib/browser' {
  interface ToDataUrlOptions {
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
  }

  const QRCode: {
    toDataURL(text: string, options?: ToDataUrlOptions): Promise<string>;
  };

  export default QRCode;
}
