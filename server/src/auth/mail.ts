import type { AppConfig } from '../config.js';

export interface SendMailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send email via Resend API, SMTP (nodemailer-style raw fetch not used),
 * or log-only fallback for local/dev.
 */
export async function sendMail(config: AppConfig, params: SendMailParams): Promise<void> {
  if (config.RESEND_API_KEY) {
    const from = config.EMAIL_FROM || 'Retroscope <onboarding@resend.dev>';
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html ?? params.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend failed (${response.status}): ${body}`);
    }
    return;
  }

  if (config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS) {
    // Lazy import so environments without SMTP don't need the dependency path at boot.
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: config.EMAIL_FROM || config.SMTP_USER,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return;
  }

  console.info('[auth-mail:dev-fallback]', {
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}
