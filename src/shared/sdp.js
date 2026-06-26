async function compress(str) {
  if (typeof CompressionStream === 'undefined') throw new Error('CompressionStream not supported');
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(new TextEncoder().encode(str));
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCodePoint(bytes[i]);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function decompress(b64url) {
  const b64 = b64url.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.codePointAt(0));
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new Response(ds.readable).text();
}

export async function encodeSdp(desc) {
  return compress(JSON.stringify(desc));
}

export async function decodeSdp(str) {
  const text = await decompress(str);
  return JSON.parse(text);
}
