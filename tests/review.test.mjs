import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validateReviewInput } from "../supabase/functions/reviews/review-validation.js";

test("accepts and trims the three review fields only", () => {
  const result = validateReviewInput({
    name: "  Alex  ",
    rating: 5,
    comment: "  Great yard cleanup!  ",
    contact: "should not be retained",
    contact_permission: true,
  });
  assert.deepEqual(result, {
    ok: true,
    value: { name: "Alex", rating: 5, comment: "Great yard cleanup!" },
  });
});

test("rejects invalid ratings, names, and comments", () => {
  for (const input of [
    { name: "Alex", rating: 0, comment: "Good work here" },
    { name: "Alex", rating: 5.5, comment: "Good work here" },
    { name: " ", rating: 5, comment: "Good work here" },
    { name: "Alex", rating: 5, comment: "Too short" },
    { name: "Alex", rating: 5, comment: "x".repeat(1001) },
    { name: "Alex", rating: "5", comment: "Good work here" },
  ]) assert.equal(validateReviewInput(input).ok, false);
});

test("review form has only name, stars, comment, and submit; no customer texting enrollment", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const form = html.match(/<form[^>]*id="reviewForm"[^>]*>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(form, "review form exists");
  assert.match(form, /id="customerName"/);
  assert.match(form, /id="customerComment"/);
  assert.match(form, /data-star="5"/);
  assert.match(form, /id="reviewSubmit"/);
  assert.doesNotMatch(form, /contact|permission|phone|email|sms/i);
  assert.match(html, /tel:\+15719195767/);
  assert.match(html, /sms:\+15719195767/);
  const app = readFileSync(new URL("../review-app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /contact_permission|reviewContact|contactPermission/);
});
