import { createClient } from "npm:@supabase/supabase-js@2";
import { importPKCS8, SignJWT } from "npm:jose@5";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders,
  });
}

async function getFirebaseAccessToken() {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) throw new Error("Firebase credentials are missing");

  const credentials = JSON.parse(raw);

  const key = await importPKCS8(
    credentials.private_key,
    "RS256",
  );

  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(credentials.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Firebase authentication failed");
  }

  const data = await response.json();

  return {
    accessToken: data.access_token as string,
    projectId: credentials.project_id as string,
  };
}

// Only routing fields from the authenticated database webhook are forwarded.
// Message content and credentials never appear in the destination URL.
function routingData(
  payload: Record<string, unknown>,
  userId: string,
): Record<string, string> {
  const data: Record<string, string> = { recipient_id: userId };
  const fields = [
    "notification_type",
    "source_table",
    "source_id",
    "message_id",
    "conversation_id",
    "sender_id",
    "event_id",
    "booking_id",
  ];
  for (const key of fields) {
    const value = payload[key];
    if (
      typeof value === "string" && value.length <= 100 &&
      /^[a-zA-Z0-9_-]+$/.test(value)
    ) data[key] = value;
  }
  const url = new URL("https://tatrycupcio.uk/");
  // The shared page router validates IDs and queries under the signed-in user's RLS.
  url.hash = new URLSearchParams({ cfa_notice: JSON.stringify(data) })
    .toString();
  data.url = url.href;
  return data;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    const suppliedSecret = request.headers.get("x-push-secret");

    if (!secret || !suppliedSecret || suppliedSecret !== secret) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const payload = await request.json();

    const userId = payload.user_id;
    const title = payload.title;
    const body = payload.body;

    if (
      typeof userId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        userId,
      ) ||
      typeof title !== "string" ||
      typeof body !== "string" ||
      !title.trim() ||
      !body.trim() ||
      title.length > 150 ||
      body.length > 1000
    ) {
      return respond({ error: "Invalid notification data" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase credentials are missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: tokens, error } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      return respond({ success: true, sent: 0 });
    }

    const destination = routingData(payload, userId);

    const { accessToken, projectId } = await getFirebaseAccessToken();

    let sent = 0;
    let failed = 0;

    for (const row of tokens) {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${
          encodeURIComponent(projectId)
        }/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              data: {
                title,
                body,
                ...destination,
              },
              android: {
                priority: "high",
              },
            },
          }),
        },
      );

      if (response.ok) {
        sent++;
      } else {
        failed++;
        console.error(
          "FCM delivery error:",
          response.status,
          await response.text(),
        );
      }
    }

    return respond({
      success: failed === 0,
      sent,
      failed,
    });
  } catch (error) {
    console.error("Push notification error:", error);
    return respond({ error: "Notification delivery failed" }, 500);
  }
});
