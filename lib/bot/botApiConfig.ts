import "server-only";

import { decryptSecret } from "@/lib/cryptoSecrets";
import { adminDb } from "@/lib/supabaseAdmin";

type BotApiSecrets = {
  id: string;
  name: string;
  provider?: string | null;
  model?: string | null;
  api_key_encrypted?: string | null;
  api_key_iv?: string | null;
  api_key_auth_tag?: string | null;
};

export async function botApiConfig(botId?: string | null) {
  if (!botId) return { openaiKey: null as string | null, model: null as string | null, source: "global" as const };
  const { data, error } = await adminDb()
    .from("bots")
    .select("id,name,provider,model,api_key_encrypted,api_key_iv,api_key_auth_tag")
    .eq("id", botId)
    .single<BotApiSecrets>();
  if (error || !data) return { openaiKey: null as string | null, model: null as string | null, source: "global" as const };
  if (data.api_key_encrypted && data.api_key_iv && data.api_key_auth_tag) {
    return {
      openaiKey: decryptSecret({ encrypted_value: data.api_key_encrypted, iv: data.api_key_iv, auth_tag: data.api_key_auth_tag }),
      model: data.model || null,
      source: "bot" as const,
    };
  }
  return { openaiKey: null as string | null, model: data.model || null, source: "global" as const };
}
