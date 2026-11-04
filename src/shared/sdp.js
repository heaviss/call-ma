async function compress(str) {
  if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream not supported');
  const buf = await new Response(new Response(str).body.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
  const bytes = new Uint8Array(buf);
  return btoa(Array.from(bytes, (b) => String.fromCodePoint(b)).join('')).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function decompress(b64url) {
  const b64 = b64url.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0));
  // pipeThrough reads while writing; awaiting writer.write() before reading deadlocks once output exceeds the stream buffer.
  return new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('deflate-raw'))).text();
}

export async function encodeSdp(desc) {
  return compress(JSON.stringify(desc));
}

export async function decodeSdp(str) {
  const text = await decompress(str);
  return JSON.parse(text);
}
