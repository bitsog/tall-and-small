import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { parseReplyCommand, twilioSignatureValid } from "../supabase/functions/review-sms/sms-protocol.js";

test("parses the two-step review reply protocol", () => {
  assert.deepEqual(parseReplyCommand("REPLY A1B2C3D4E5 Thank you for the feedback!"), {
    type: "reply",
    code: "a1b2c3d4e5",
    content: "Thank you for the feedback!",
  });
  assert.deepEqual(parseReplyCommand(" YES a1b2c3d4e5 "), { type: "confirm", code: "a1b2c3d4e5" });
  assert.deepEqual(parseReplyCommand("YES bad-code"), { type: "other" });
});

test("validates Twilio signatures against the exact URL and all form fields", async () => {
  const token = "test-token-only";
  const url = "https://example.test/functions/v1/review-sms";
  const form = new URLSearchParams([["Body", "REPLY abcdef1234 Nice work"], ["From", "+15555550100"]]);
  let signed = url;
  for (const key of [...new Set([...form.keys()])].sort()) for (const value of form.getAll(key)) signed += key + value;
  const signature = createHmac("sha1", token).update(signed).digest("base64");
  assert.equal(await twilioSignatureValid({ url, expectedUrl: url, signature, form, token }), true);
  assert.equal(await twilioSignatureValid({ url: url + "?x=1", expectedUrl: url, signature, form, token }), false);
  const changedForm = new URLSearchParams([["Body", "REPLY abcdef1234 Fake"], ["From", "+15555550100"]]);
  assert.equal(await twilioSignatureValid({ url, expectedUrl: url, signature, form: changedForm, token }), false);
});
