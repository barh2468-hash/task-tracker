import nodemailer from 'npm:nodemailer@9.1.1';

export type EmailAttachment = {
  filename: string;
  content: string | Uint8Array;
  contentType?: string;
  encoding?: 'base64';
};

export type SendEmailOptions = {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name} secret`);
  return value;
}

function loadSmtpConfig(): SmtpConfig {
  const host = requiredEnv('SMTP_HOST');
  const user = requiredEnv('SMTP_USER');
  const password = requiredEnv('SMTP_PASSWORD');
  const from = requiredEnv('SMTP_FROM');
  const portValue = Deno.env.get('SMTP_PORT')?.trim() || '465';
  const port = Number(portValue);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid port number');
  }

  const secureValue = Deno.env.get('SMTP_SECURE')?.trim().toLowerCase();
  const secure = secureValue === undefined
    ? port === 465
    : ['1', 'true', 'yes'].includes(secureValue);

  return { host, port, secure, user, password, from };
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let senderAddress: string | null = null;

function getTransporter() {
  if (transporter && senderAddress) return { transporter, from: senderAddress };

  const config = loadSmtpConfig();
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  senderAddress = config.from;

  return { transporter, from: senderAddress };
}

function normalizeAddresses(addresses: unknown[] | undefined) {
  return (addresses || []).map((address) => String(address));
}

async function sendViaSmtp(options: SendEmailOptions) {
  const smtp = getTransporter();
  const info = await smtp.transporter.sendMail({
    from: smtp.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  });

  return {
    provider: 'gmail-smtp' as const,
    messageId: info.messageId,
    accepted: normalizeAddresses(info.accepted),
    rejected: normalizeAddresses(info.rejected),
    response: info.response,
  };
}

function encodeBase64(bytes: Uint8Array) {
  const chunkSize = 32_768;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function summarizeError(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) };

  const smtpError = error as Error & {
    code?: string;
    command?: string;
    responseCode?: number;
  };

  return {
    name: smtpError.name,
    message: smtpError.message,
    code: smtpError.code,
    command: smtpError.command,
    responseCode: smtpError.responseCode,
  };
}

function acceptedRecipientsFromError(error: unknown) {
  if (!error || typeof error !== 'object' || !('accepted' in error)) return [];
  const accepted = (error as { accepted?: unknown }).accepted;
  return Array.isArray(accepted) ? normalizeAddresses(accepted) : [];
}

async function sendViaResend(options: SendEmailOptions) {
  const apiKey = requiredEnv('RESEND_API_KEY');
  const from = requiredEnv('FROM_EMAIL');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      ...(options.text !== undefined ? { text: options.text } : {}),
      ...(options.attachments?.length
        ? {
          attachments: options.attachments.map((attachment) => ({
            filename: attachment.filename,
            content: typeof attachment.content === 'string'
              ? attachment.content
              : encodeBase64(attachment.content),
          })),
        }
        : {}),
    }),
  });

  const responseText = await response.text();
  let responseBody: { id?: string; message?: string } = {};

  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    // Keep provider responses out of client-facing errors while retaining status logs.
  }

  if (!response.ok || !responseBody.id) {
    console.error('Resend fallback rejected the email:', {
      status: response.status,
      message: responseBody.message || 'Unexpected response',
    });
    throw new Error(`Resend request failed with status ${response.status}`);
  }

  return {
    provider: 'resend' as const,
    id: responseBody.id,
    accepted: options.to,
    rejected: [] as string[],
  };
}

export async function sendEmail(options: SendEmailOptions) {
  if (!options.to.length) throw new Error('At least one email recipient is required');

  try {
    const result = await sendViaSmtp(options);
    if (result.accepted.length > 0) return result;

    console.warn('Gmail SMTP accepted no recipients; trying Resend fallback.');
  } catch (smtpError) {
    if (acceptedRecipientsFromError(smtpError).length > 0) {
      console.error(
        'Gmail SMTP reported an error after accepting recipients; Resend fallback skipped to avoid duplicates:',
        summarizeError(smtpError),
      );
      throw new Error('Gmail SMTP delivery was partially accepted; fallback skipped to avoid duplicates');
    }

    console.warn('Gmail SMTP failed; trying Resend fallback:', summarizeError(smtpError));
  }

  try {
    return await sendViaResend(options);
  } catch (resendError) {
    console.error('Both email providers failed:', summarizeError(resendError));
    throw new Error('Email delivery failed through Gmail SMTP and Resend');
  }
}
