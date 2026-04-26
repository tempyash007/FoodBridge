const nodemailer = require('nodemailer');

// ─── SMTP Transporter ────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: false, // true for 465, false for 587 (STARTTLS)
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

/**
 * Send a password-reset email with FoodBridge branding.
 *
 * @param {string} to        — recipient email address
 * @param {string} resetLink — full URL the user clicks to reset
 * @param {string} firstName — user's first name for the greeting
 */
const sendPasswordResetEmail = async (to, resetLink, firstName) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Reset your FoodBridge password',

        // ── Plain-text fallback ──────────────────────────────────────────
        text: [
            `Hi ${firstName},`,
            '',
            'We received a request to reset your FoodBridge password.',
            '',
            'Click the link below to set a new password:',
            resetLink,
            '',
            'This link will expire in 15 minutes.',
            '',
            'If you did not request a password reset, you can safely ignore this email.',
            '',
            'Thanks,',
            'The FoodBridge Team',
        ].join('\n'),

        // ── HTML email ───────────────────────────────────────────────────
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #38b2ac 0%, #2f855a 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                🍽️ FoodBridge
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a202c;font-size:22px;font-weight:600;">
                Reset Your Password
              </h2>
              <p style="margin:0 0 16px;color:#4a5568;font-size:16px;line-height:1.6;">
                Hi <strong>${firstName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#4a5568;font-size:16px;line-height:1.6;">
                We received a request to reset your FoodBridge account password.
                Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:linear-gradient(135deg, #38b2ac 0%, #2f855a 100%);">
                    <a href="${resetLink}"
                       target="_blank"
                       style="display:inline-block;padding:14px 36px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;border-radius:8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background-color:#fff5f5;border-left:4px solid #fc8181;padding:12px 16px;border-radius:0 6px 6px 0;">
                    <p style="margin:0;color:#c53030;font-size:14px;font-weight:500;">
                      ⏰ This link expires in <strong>15 minutes</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#718096;font-size:14px;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${resetLink}" style="color:#38b2ac;font-size:13px;">${resetLink}</a>
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

              <p style="margin:0;color:#a0aec0;font-size:13px;line-height:1.6;">
                If you did not request a password reset, please ignore this email.
                Your password will remain unchanged.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f7fafc;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">
                &copy; ${new Date().getFullYear()} FoodBridge &mdash; Connecting food to those who need it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('❌ Email send failed:', error.message);
        throw new Error('Failed to send password reset email');
    }
};

/**
 * Send a generic notification email with FoodBridge branding.
 *
 * @param {string} to        — recipient email address
 * @param {string} firstName — user's first name for the greeting
 * @param {Object} opts
 * @param {string} opts.subject — email subject line
 * @param {string} opts.title   — bold heading inside email body
 * @param {string} opts.message — detail paragraph
 */
const sendNotificationEmail = async (to, firstName, { subject, title, message }) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject: subject || title || 'FoodBridge Notification',

        // ── Plain-text fallback ──────────────────────────────────────────
        text: [
            `Hi ${firstName},`,
            '',
            title || 'Notification',
            '',
            message,
            '',
            'Thanks,',
            'The FoodBridge Team',
        ].join('\n'),

        // ── HTML email ───────────────────────────────────────────────────
        html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #38b2ac 0%, #2f855a 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">
                🍽️ FoodBridge
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#1a202c;font-size:22px;font-weight:600;">
                ${title || 'Notification'}
              </h2>
              <p style="margin:0 0 16px;color:#4a5568;font-size:16px;line-height:1.6;">
                Hi <strong>${firstName}</strong>,
              </p>
              <p style="margin:0 0 24px;color:#4a5568;font-size:16px;line-height:1.6;">
                ${message}
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />

              <p style="margin:0;color:#a0aec0;font-size:13px;line-height:1.6;">
                This is an automated notification from FoodBridge. Please do not reply to this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f7fafc;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#a0aec0;font-size:12px;">
                &copy; ${new Date().getFullYear()} FoodBridge &mdash; Connecting food to those who need it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('❌ Notification email send failed:', error.message);
        // Never crash — swallow the error
    }
};

module.exports = { sendPasswordResetEmail, sendNotificationEmail };
