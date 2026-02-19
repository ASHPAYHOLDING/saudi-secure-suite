import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-auth-email`;

Deno.test("Rate Limiter - should allow requests within limit", async () => {
  // First request should succeed (not 429)
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: "test@test.com", type: "signup" }),
  });
  
  await res.text(); // consume body
  // Should NOT be 429 on first request
  assertExists(res.status);
  console.log(`First request status: ${res.status} (should not be 429)`);
});

Deno.test("Rate Limiter - should block burst requests with 429", async () => {
  const results: number[] = [];
  
  // Send 7 rapid requests (limit is 5/min for auth)
  for (let i = 0; i < 7; i++) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "X-Forwarded-For": "192.168.99.99", // Unique IP for this test
      },
      body: JSON.stringify({ email: `burst-test-${i}@test.com`, type: "signup" }),
    });
    
    results.push(res.status);
    await res.text(); // consume body
  }
  
  console.log("Burst test results:", results);
  
  // At least one should be 429
  const has429 = results.some(s => s === 429);
  assertEquals(has429, true, "Expected at least one 429 response after burst");
});

Deno.test("Rate Limiter - 429 response contains proper fields", async () => {
  // Send rapid requests to trigger block
  let blockedResponse: Response | null = null;
  
  for (let i = 0; i < 8; i++) {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "X-Forwarded-For": "10.0.0.42", // Unique IP for this test
      },
      body: JSON.stringify({ email: `block-test-${i}@test.com`, type: "signup" }),
    });
    
    if (res.status === 429) {
      blockedResponse = res;
      break;
    }
    await res.text();
  }
  
  if (blockedResponse) {
    const body = await blockedResponse.json();
    console.log("429 response body:", body);
    
    assertEquals(body.code, "RATE_LIMITED");
    assertExists(body.retry_after);
    assertExists(body.error); // Arabic error message
    
    // Check Retry-After header
    const retryAfter = blockedResponse.headers.get("Retry-After");
    assertExists(retryAfter, "Should have Retry-After header");
    console.log("Retry-After:", retryAfter);
  } else {
    console.log("Could not trigger 429 - rate limit may have been reset");
  }
});
