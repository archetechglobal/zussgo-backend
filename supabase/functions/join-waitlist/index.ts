import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error("Please provide a valid email address.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // 1. Insert the email
    const { error: dbError } = await supabase
      .from("waitlist")
      .insert([{ email: email.toLowerCase() }]);

    if (dbError) {
      if (dbError.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, message: "already_joined" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      throw dbError;
    }

    // 2. GET COUNT - Updated logic to be more robust
    const { count, error: countError } = await supabase
      .from("waitlist")
      .select("*", { count: "exact" }); // Removed 'head: true' to ensure fresh count

    if (countError) console.error("Count Error:", countError);

    // If count is null/0, we still want to show at least 412 for the first user
    const totalCount = count ?? 0;
    const displayRank = totalCount + 411;

    // 3. Send the Email
    resend.emails.send({
      from: "ZussGo <hello@zussgo.com>",
      to: email,
      subject: "You're in! Your ZussGo boarding pass is here 🎫",
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; background-color: #f9f9f9; padding: 40px 10px;">
          <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            
            <div style="background: linear-gradient(135deg, #7B2FF7 0%, #F15A24 100%); padding: 30px; text-align: center;">
              <span style="background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 100px; color: white; font-size: 12px; font-weight: bold; letter-spacing: 1px;">STATUS: CONFIRMED</span>
              <h1 style="color: white; margin-top: 15px; margin-bottom: 0; font-size: 28px; letter-spacing: -1px;">Pack your bags.</h1>
            </div>

            <div style="padding: 40px 30px; text-align: center;">
              <p style="font-size: 18px; color: #1a1a1a; font-weight: 500; margin-bottom: 8px;">Main character energy only. ✨</p>
              <p style="font-size: 15px; color: #64748b; line-height: 1.6; margin-top: 0;">
                You're officially off the waitlist and into the inner circle. We're building the future of social travel, and honestly? It wouldn't be the same without you.
              </p>

              <div style="margin: 30px 0; border: 2px dashed #e2e8f0; border-radius: 16px; padding: 25px; position: relative;">
                <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Global Priority Rank</p>
                <h2 style="margin: 10px 0; font-size: 48px; color: #7B2FF7; letter-spacing: -2px;">#${displayRank}</h2>
                <div style="display: inline-block; background: #f1f5f9; padding: 6px 12px; border-radius: 8px; font-size: 12px; color: #475569; font-weight: 600;">GATE: ZUSS-GO-LOBBY</div>
              </div>

              <p style="font-size: 14px; color: #64748b;">
                Keep an eye on your inbox. We're letting explorers in small batches. Stay ready.
              </p>

              <a href="https://zussgo.vercel.app" style="display: inline-block; margin-top: 20px; background: #1a1a1a; color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px;">Explore the Vibe</a>
            </div>

            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                ZussGo Travel Tech • Hyderabad <br>
                <span style="font-style: italic; margin-top: 5px; display: block;">No boring trips. No mid travelers.</span>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return new Response(JSON.stringify({ success: true, count: displayRank }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
