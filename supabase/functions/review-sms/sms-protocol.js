export function parseReplyCommand(body) {
  const text = body.trim();
  const reply = text.match(/^REPLY\s+([0-9a-f]{10})\s+([\s\S]+)$/i);
  if (reply) return { type: "reply", code: reply[1].toLowerCase(), content: reply[2].trim() };
  const confirm = text.match(/^YES\s+([0-9a-f]{10})$/i);
  if (confirm) return { type: "confirm", code: confirm[1].toLowerCase() };
  return { type: "other" };
}

export async function twilioSignatureValid({ url, expectedUrl, signature, form, token }) {
  if (!token || !expectedUrl || url !== expectedUrl || !signature) return false;
  const keys = Array.from(new Set(Array.from(form.keys()))).sort();
  let signedUrl = expectedUrl;
  for (const key of keys) {
    for (const value of form.getAll(key)) signedUrl += key + value;
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedUrl));
  const expected = btoa(String.fromCharCode(...new Uint8Array(raw)));
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
