// A Response built from a string or bytes always has a body; the DOM types still say `| null`.
function bodyOf(source: string | Uint8Array<ArrayBuffer>): ReadableStream<Uint8Array<ArrayBuffer>> {
  return new Response(source).body as ReadableStream<Uint8Array<ArrayBuffer>>;
}

async function compress(str: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream not supported');
  }
  const buf = await new Response(
    bodyOf(str).pipeThrough(new CompressionStream('deflate-raw')),
  ).arrayBuffer();
  const bytes = new Uint8Array(buf);
  return btoa(Array.from(bytes, (b) => String.fromCodePoint(b)).join(''))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function decompress(b64url: string): Promise<string> {
  const b64 = b64url.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => Number(c.codePointAt(0)));
  // pipeThrough reads while writing; awaiting writer.write() before reading deadlocks once output exceeds the stream buffer.
  return new Response(bodyOf(bytes).pipeThrough(new DecompressionStream('deflate-raw'))).text();
}

export async function encodeSdp(desc: RTCSessionDescriptionInit | null): Promise<string> {
  return compress(JSON.stringify(desc));
}

export async function decodeSdp(str: string): Promise<RTCSessionDescriptionInit> {
  const text = await decompress(str);
  return JSON.parse(text) as RTCSessionDescriptionInit;
}
