import assert from "node:assert/strict";
import test from "node:test";

import { getSubscriberSignupResult, type SubscriberLookup } from "../lib/newsletter/subscribers";
import { normalizeSubscriberEmail } from "../lib/newsletter/validation";

function subscriberLookup(existingEmails: string[]): SubscriberLookup {
  return {
    async findUnique({ where }) {
      return existingEmails.includes(where.email) ? { id: "subscriber-1" } : null;
    },
  };
}

test("normalizeSubscriberEmail trims and lowercases valid addresses", () => {
  assert.equal(normalizeSubscriberEmail("  Reader@Example.COM  "), "reader@example.com");
});

test("normalizeSubscriberEmail rejects invalid, non-string, and too-long values", () => {
  assert.equal(normalizeSubscriberEmail("not-an-email"), null);
  assert.equal(normalizeSubscriberEmail("reader@example"), null);
  assert.equal(normalizeSubscriberEmail(undefined), null);
  assert.equal(normalizeSubscriberEmail(`${"a".repeat(310)}@example.com`), null);
});

test("getSubscriberSignupResult identifies new subscribers", async () => {
  assert.deepEqual(await getSubscriberSignupResult("reader@example.com", subscriberLookup([])), {
    email: "reader@example.com",
    message: "You are on the list.",
    status: "new",
  });
});

test("getSubscriberSignupResult handles duplicate and invalid subscriber states", async () => {
  assert.deepEqual(
    await getSubscriberSignupResult("reader@example.com", subscriberLookup(["reader@example.com"])),
    {
      message: "That email is already subscribed.",
      status: "duplicate",
    },
  );

  assert.deepEqual(await getSubscriberSignupResult(null, subscriberLookup([])), {
    message: "Enter a valid email address.",
    status: "invalid",
  });
});
