const Mailjet = require("node-mailjet");
const env = require("../../env");

class MailService {
  constructor() {
    this.client = null;
    if (env.MAILJET_API_KEY && env.MAILJET_SECRET_KEY) {
      this.client = Mailjet.apiConnect(env.MAILJET_API_KEY, env.MAILJET_SECRET_KEY);
    }
  }

  /**
   * Send an email verification link
   * @param {Object} options
   * @param {string} options.toEmail
   * @param {string} options.name
   * @param {string} options.token
   * @returns {Promise<{ sent: boolean, simulated?: boolean }>}
   */
  async sendVerificationEmail({ toEmail, name, token }) {
    const backendBase = (env.BACKEND_URL || "http://localhost:5001").replace(/\/+$/, "");
    const frontendBase = (env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, "");
    const directVerifyUrl = `${backendBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
    const verificationUrl = directVerifyUrl;
    const frontendVerifyUrl = `${frontendBase}/?token=${encodeURIComponent(token)}`;
    const subject = "Verify your email address - Dormammu Loop";
    const displayName = name || "there";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
        <div style="max-width: 560px; margin: 0 auto; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 36px; color: #f8fafc; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #818cf8; font-size: 24px; margin: 0; font-weight: 700; letter-spacing: -0.5px;">Dormammu Loop</h1>
            <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Distributed DAG Workflow & Automation Engine</p>
          </div>
          
          <h2 style="color: #f1f5f9; font-size: 18px; margin-bottom: 16px;">Welcome, ${displayName}!</h2>
          <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
            Thank you for creating an account. To activate your account and start building automated loops, please verify your email address by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${directVerifyUrl}" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
              Activate Account & Verify Email
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5;">
            This link is valid for <strong>${env.EMAIL_VERIFICATION_EXPIRATION_HOURS} hours</strong>. If you did not sign up for Dormammu Loop, you can safely disregard this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #334155; margin: 28px 0 16px 0;" />
          <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
            Sent by Dormammu Loop • Secure Account Authentication
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Hi ${displayName},

Welcome to Dormammu Loop!

Please verify your email address and activate your account by clicking the following link:
${directVerifyUrl}

This link is valid for ${env.EMAIL_VERIFICATION_EXPIRATION_HOURS} hours. If you did not create this account, please ignore this email.
    `.trim();

    if (!this.client) {
      console.log(`\n[EMAIL SERVICE - DEV MODE] Mailjet credentials not configured. Simulated email to: ${toEmail}`);
      console.log(`[EMAIL SERVICE - DEV MODE] Subject: ${subject}`);
      console.log(`[EMAIL SERVICE - DEV MODE] Verification URL: ${verificationUrl}\n`);
      return { sent: true, simulated: true, verificationUrl, token };
    }

    try {
      const response = await this.client
        .post("send", { version: "v3.1" })
        .request({
          Messages: [
            {
              From: {
                Email: env.MAILJET_SENDER_EMAIL,
                Name: env.MAILJET_SENDER_NAME,
              },
              To: [
                {
                  Email: toEmail,
                  Name: displayName,
                },
              ],
              Subject: subject,
              TextPart: textContent,
              HTMLPart: htmlContent,
            },
          ],
        });

      return { sent: true, data: response.body, verificationUrl, token };
    } catch (err) {
      console.error("Mailjet API send failure:", err && err.message ? err.message : err);
      // Fallback log so link isn't lost
      console.log(`[EMAIL FALLBACK] Verification link for ${toEmail}: ${verificationUrl}`);
      return { sent: false, error: err.message, verificationUrl, token };
    }
  }
}

module.exports = new MailService();
