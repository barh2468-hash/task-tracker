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

export async function sendEmail(options: SendEmailOptions) {
  if (!options.to.length) throw new Error('At least one email recipient is required');
  return sendViaSmtp(options);
}
