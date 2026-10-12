import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Buffer } from 'node:buffer';

// Reads a scanned/photographed vehicle document (traffic fine, insurance
// policy, test/registration certificate) with a Claude vision model and
// returns structured fields. Nothing is saved here: the manager
// reviews and corrects the result in the app before it is stored.
//
// Only managers may call it. The file is read through the caller's own
// session, so storage RLS applies. The API key is an Edge Function secret
// (ANTHROPIC_API_KEY) and never reaches the browser.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const BUCKET = 'vehicle-documents';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
const MAX_BYTES = 10 * 1024 * 1024;

const uncertain = {
  type: 'array',
  items: { type: 'string' },
  description: 'Names of fields that are unreadable, cut off, or that you are not sure about. Leave the field null instead of guessing.',
};
const nullableString = (description: string) => ({ type: ['string', 'null'], description });
const nullableNumber = (description: string) => ({ type: ['number', 'null'], description });

const TOOLS: Record<string, { description: string; schema: Record<string, unknown> }> = {
  fine: {
    description: 'Details of an Israeli traffic / parking fine (דוח).',
    schema: {
      fine_number: nullableString('Fine / report number (מספר דוח / מספר הודעה)'),
      plate_number: nullableString('Vehicle plate number, digits and dashes only'),
      offense_at: nullableString('Date and time of the offense, local Israel time, format YYYY-MM-DDTHH:MM (time may be missing: use T00:00)'),
      offense_description: nullableString('The offense, in Hebrew as written (תיאור העבירה)'),
      location: nullableString('Place of the offense'),
      authority: nullableString('Issuing authority (e.g. משטרת ישראל, עירייה)'),
      amount_ils: nullableNumber('The amount currently payable in ILS. If there are several amounts, use the one payable now and mention the rest in notes'),
      due_date: nullableString('Last date to pay, format YYYY-MM-DD'),
      points: nullableNumber('Penalty points (נקודות), if shown'),
      notes: nullableString('Anything important that does not fit the other fields, e.g. a discounted amount and its deadline'),
    },
  },
  policy: {
    description: 'Details of a vehicle insurance policy or certificate (פוליסה / תעודת ביטוח).',
    schema: {
      insurer: nullableString('Insurance company'),
      agent: nullableString('Insurance agent / agency, if shown'),
      policy_number: nullableString('Policy number'),
      plate_number: nullableString('Vehicle plate number, digits and dashes only'),
      kind: { type: ['string', 'null'], enum: ['mandatory', 'comprehensive', 'third_party', null], description: 'mandatory = ביטוח חובה, comprehensive = מקיף, third_party = צד ג׳' },
      valid_from: nullableString('Start of coverage, YYYY-MM-DD'),
      valid_to: nullableString('End of coverage, YYYY-MM-DD'),
      premium_ils: nullableNumber('Total premium in ILS, if shown'),
    },
  },
  inspection: {
    description: 'Details of a vehicle annual test (טסט) or registration certificate (רישיון רכב).',
    schema: {
      plate_number: nullableString('Vehicle plate number, digits and dashes only'),
      inspected_on: nullableString('Date the test was performed, YYYY-MM-DD'),
      valid_to: nullableString('Date until which the license / test is valid (תוקף רישיון), YYYY-MM-DD'),
      station: nullableString('Test station, if shown'),
      result: nullableString('Result, if shown'),
    },
  },
};

type Block = { type: string; source: { type: 'base64'; media_type: string; data: string } };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ ok: false, error: 'unauthorized' }, 401);

    const { data: profile } = await userClient.from('profiles').select('role').eq('id', userData.user.id).maybeSingle();
    if (!['manager', 'admin'].includes(profile?.role)) return json({ ok: false, error: 'forbidden' }, 403);

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ ok: false, error: 'ai_not_configured' });

    const { path, kind } = await req.json();
    const tool = TOOLS[String(kind)];
    if (!tool) return json({ ok: false, error: 'unknown_kind' }, 400);
    if (typeof path !== 'string' || !path.startsWith('vehicles/')) return json({ ok: false, error: 'invalid_path' }, 400);

    const { data: file, error: downloadError } = await userClient.storage.from(BUCKET).download(path);
    if (downloadError || !file) return json({ ok: false, error: 'file_not_found' }, 404);
    if (file.size > MAX_BYTES) return json({ ok: false, error: 'file_too_large' }, 413);

    const mediaType = file.type || 'application/octet-stream';
    const isPdf = mediaType === 'application/pdf';
    if (!isPdf && !['image/jpeg', 'image/png'].includes(mediaType)) return json({ ok: false, error: 'unsupported_type' }, 415);
    const data = Buffer.from(await file.arrayBuffer()).toString('base64');
    const fileBlock: Block = { type: isPdf ? 'document' : 'image', source: { type: 'base64', media_type: mediaType, data } };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        tools: [{
          name: 'record_document',
          description: tool.description,
          input_schema: {
            type: 'object',
            properties: { ...tool.schema, uncertain_fields: uncertain },
            required: [...Object.keys(tool.schema), 'uncertain_fields'],
          },
        }],
        tool_choice: { type: 'tool', name: 'record_document' },
        messages: [{
          role: 'user',
          content: [
            fileBlock,
            {
              type: 'text',
              text: 'Extract the fields from this Israeli document exactly as printed. The document is usually in Hebrew. '
                + 'Use null for anything you cannot read with confidence; never invent values. Dates in the document are day/month/year.',
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error('Anthropic API error', response.status, await response.text());
      return json({ ok: false, error: 'ai_failed' });
    }
    const result = await response.json();
    const block = (result.content || []).find((item: { type: string }) => item.type === 'tool_use');
    if (!block) return json({ ok: false, error: 'ai_no_result' });

    const { uncertain_fields: uncertainFields, ...fields } = block.input as Record<string, unknown>;
    return json({ ok: true, fields, uncertain: Array.isArray(uncertainFields) ? uncertainFields : [] });
  } catch (error) {
    console.error('analyze-vehicle-document failed', error);
    return json({ ok: false, error: 'internal' }, 500);
  }
});
