export function validateReviewInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false };
  }

  const { name, comment, rating } = input;
  if (typeof name !== "string" || typeof comment !== "string" || typeof rating !== "number") {
    return { ok: false };
  }

  const normalized = { name: name.trim(), rating, comment: comment.trim() };
  if (
    normalized.name.length < 1 ||
    normalized.name.length > 60 ||
    normalized.comment.length < 10 ||
    normalized.comment.length > 1000 ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return { ok: false };
  }

  // Deliberately returns only the three customer review fields. Optional contact data
  // is not accepted or stored by this review flow.
  return { ok: true, value: normalized };
}
