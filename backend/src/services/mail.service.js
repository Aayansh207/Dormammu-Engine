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
    const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${token}`;
    const subject = "Verify your email - Dormammu Loop";
    const displayName = name || "there";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #6366f1;">Welcome to Dormammu Loop!</h2>
        <p>Hi ${displayName},</p>
        <p>Thank you for signing up for Dormammu Loop — Distributed DAG Workflow & Automation Engine.</p>
        <p>Please click the button below to verify your email address. This link is valid for ${env.EMAIL_VERIFICATION_EXPIRATION_HOURS} hours:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 14px;">Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #6366f1; font-size: 13px;">${verificationUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">If you did not create this account, you can safely ignore this email.</p>
      </div>
    `;

    const textContent = `
Hi ${displayName},

Please verify your email address for Dormammu Loop by opening the following link in your browser:
${verificationUrl}

This link is valid for ${env.EMAIL_VERIFICATION_EXPIRATION_HOURS} hours.

If you did not create this account, please ignore this email.
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
