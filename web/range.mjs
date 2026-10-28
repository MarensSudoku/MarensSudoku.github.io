export function parseByteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2])) return undefined;
  const first = match[1] ? Number(match[1]) : null, last = match[2] ? Number(match[2]) : null;
  if ((first !== null && !Number.isSafeInteger(first)) || (last !== null && !Number.isSafeInteger(last))) return undefined;
  const start = first === null ? Math.max(0, size - last) : first;
  const end = first === null || last === null ? size - 1 : Math.min(last, size - 1);
  return start > end || start >= size || !size ? null : { start, end };
}

export async function rangeResponse(response, header) {
  if (response.status !== 200 || !header) return response;
  const blob = await response.blob(), range = parseByteRange(header, blob.size);
  const headers = new Headers(response.headers);
  headers.delete('Content-Encoding'); headers.set('Accept-Ranges', 'bytes');
  if (range === undefined) { headers.set('Content-Length', String(blob.size)); return new Response(blob, { status: 200, headers }); }
  if (range === null) { headers.set('Content-Range', `bytes */${blob.size}`); headers.set('Content-Length', '0'); return new Response(null, { status: 416, headers }); }
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${blob.size}`);
  headers.set('Content-Length', String(range.end - range.start + 1));
  return new Response(blob.slice(range.start, range.end + 1, blob.type), { status: 206, headers });
}
