import nodemailer from 'nodemailer';

const isEmailConfigured = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  return (
    Boolean(user) &&
    Boolean(pass) &&
    !user.includes('your-email@gmail.com') &&
    !pass.includes('your-app-password')
  );
};

export const sendPasswordResetEmail = async (to, otp, userName = 'User') => {
  if (!isEmailConfigured()) {
    console.log(
      `\n============================================================\n` +
      `[EMAIL SERVICE NOTICE] SMTP credentials not set in .env.\n` +
      `Recipient: ${to}\n` +
      `Verification Code: ${otp}\n` +
      `Expiry: 15 minutes\n` +
      `Tip: To send real emails, set EMAIL_USER & EMAIL_PASS in server/.env\n` +
      `============================================================\n`
    );
    return { success: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const fromAddress = process.env.EMAIL_FROM || `"SVCORA SpendX" <${process.env.EMAIL_USER}>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 24px; }
        .card { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 24px; font-weight: bold; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0; opacity: 0.85; font-size: 13px; }
        .body { padding: 32px 24px; color: #374151; }
        .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
        .intro { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
        .otp-container { text-align: center; margin: 28px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px; border: 1px dashed #cbd5e1; }
        .otp-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; margin: 0; }
        .expiry { font-size: 12px; color: #ef4444; margin-top: 8px; font-weight: 500; }
        .footer { padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>SVCORA SpendX</h1>
          <p>Enterprise Expense Management Platform</p>
        </div>
        <div class="body">
          <div class="greeting">Hello ${userName || 'there'},</div>
          <p class="intro">
            We received a request to reset your password for your <strong>SVCORA SpendX</strong> account.
            Use the verification code below to proceed with resetting your password:
          </p>
          <div class="otp-container">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="expiry">Expires in 15 minutes</div>
          </div>
          <p class="intro" style="font-size: 13px; color: #6b7280;">
            If you did not make this request, you can safely ignore this email. Your current password will remain unchanged.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SVCORA SpendX. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject: `[SVCORA SpendX] Password Reset Code: ${otp}`,
      text: `Your password reset code is: ${otp}. It will expire in 15 minutes.`,
      html: htmlContent,
    });

    console.log(`[EMAIL SENT] Password reset code dispatched to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
    // Return simulated success so user is not stuck if SMTP network is down
    return { success: false, error: error.message };
  }
};

const sendGenericWorkflowEmail = async ({ to, subject, htmlContent, textContent }) => {
  if (!to) return { success: false, error: 'No recipient email specified' };

  if (!isEmailConfigured()) {
    console.log(
      `\n============================================================\n` +
      `[WORKFLOW EMAIL SIMULATION]\n` +
      `To: ${to}\n` +
      `Subject: ${subject}\n` +
      `Body: ${textContent}\n` +
      `============================================================\n`
    );
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const fromAddress = process.env.EMAIL_FROM || `"SVCORA SpendX" <${process.env.EMAIL_USER}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[EMAIL SENT] Notification dispatched to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to dispatch workflow email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

export const sendClaimSubmittedEmail = async ({ to, managerName, employeeName, expenseId, category, amount }) => {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subject = `[SpendX Action Required] New Expense Claim from ${employeeName} (${formattedAmount})`;
  const textContent = `Hello ${managerName || 'Manager'},\n\nA new expense claim (#${expenseId}) has been submitted by ${employeeName} for ${formattedAmount} under "${category}".\n\nPlease review and approve the claim at http://localhost:8080/approvals\n\n- SVCORA SpendX`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #4f46e5; padding: 20px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">SVCORA SpendX</h2>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Expense Approval Required</p>
      </div>
      <div style="padding: 24px; color: #1e293b;">
        <p style="margin-top: 0;">Hello <strong>${managerName || 'Manager'}</strong>,</p>
        <p>A new site-visit / operational expense claim requires your 1-Up review:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong>Employee:</strong> ${employeeName}</div>
          <div style="margin-bottom: 6px;"><strong>Claim ID:</strong> #${expenseId}</div>
          <div style="margin-bottom: 6px;"><strong>Category:</strong> ${category}</div>
          <div style="margin-bottom: 0;"><strong>Amount:</strong> <span style="font-size: 16px; font-weight: bold; color: #4f46e5;">${formattedAmount}</span></div>
        </div>
        <p style="text-align: center; margin: 24px 0;">
          <a href="http://localhost:8080/approvals" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Review in Approvals Queue &rarr;</a>
        </p>
      </div>
      <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        SVC Infosystems &bull; Automated Workflow Notification
      </div>
    </div>
  `;

  return sendGenericWorkflowEmail({ to, subject, htmlContent, textContent });
};

export const sendClaimApprovedEmail = async ({ to, employeeName, expenseId, category, amount, approverName }) => {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subject = `[SpendX] Claim #${expenseId} Approved by ${approverName}`;
  const textContent = `Hello ${employeeName || 'Employee'},\n\nYour expense claim #${expenseId} (${category} for ${formattedAmount}) has been approved by ${approverName} and routed to Finance for payment processing.\n\nView claim status at http://localhost:8080/claims\n\n- SVCORA SpendX`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #10b981; padding: 20px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">SVCORA SpendX</h2>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Claim Approved</p>
      </div>
      <div style="padding: 24px; color: #1e293b;">
        <p style="margin-top: 0;">Hello <strong>${employeeName || 'Employee'}</strong>,</p>
        <p>Great news! Your expense claim has been approved:</p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong>Claim ID:</strong> #${expenseId}</div>
          <div style="margin-bottom: 6px;"><strong>Category:</strong> ${category}</div>
          <div style="margin-bottom: 6px;"><strong>Amount:</strong> <span style="font-size: 16px; font-weight: bold; color: #059669;">${formattedAmount}</span></div>
          <div style="margin-bottom: 0;"><strong>Approved By:</strong> ${approverName}</div>
        </div>
        <p style="font-size: 13px; color: #64748b;">The report has now advanced to Finance for accounting review and reimbursement disbursal.</p>
      </div>
      <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        SVC Infosystems &bull; Automated Workflow Notification
      </div>
    </div>
  `;

  return sendGenericWorkflowEmail({ to, subject, htmlContent, textContent });
};

export const sendClaimSentBackEmail = async ({ to, employeeName, expenseId, category, amount, reviewerName, comment }) => {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subject = `[SpendX Action Required] Claim #${expenseId} Sent Back for Correction`;
  const textContent = `Hello ${employeeName || 'Employee'},\n\nYour expense claim #${expenseId} (${formattedAmount}) has been sent back by ${reviewerName}.\n\nFeedback / Correction Required: "${comment}"\n\nPlease update your claim and resubmit at http://localhost:8080/claims\n\n- SVCORA SpendX`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #f59e0b; padding: 20px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">SVCORA SpendX</h2>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Action Required: Claim Sent Back</p>
      </div>
      <div style="padding: 24px; color: #1e293b;">
        <p style="margin-top: 0;">Hello <strong>${employeeName || 'Employee'}</strong>,</p>
        <p>Your reviewer <strong>${reviewerName}</strong> has sent back your expense claim for correction:</p>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong>Claim ID:</strong> #${expenseId} (${category})</div>
          <div style="margin-bottom: 8px;"><strong>Amount:</strong> ${formattedAmount}</div>
          <div style="background: #ffffff; padding: 10px; border-radius: 6px; border: 1px dashed #f59e0b; font-style: italic; color: #b45309;">
            &quot;${comment}&quot;
          </div>
        </div>
        <p style="text-align: center; margin: 24px 0;">
          <a href="http://localhost:8080/claims" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Edit & Resubmit Claim &rarr;</a>
        </p>
      </div>
      <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        SVC Infosystems &bull; Automated Workflow Notification
      </div>
    </div>
  `;

  return sendGenericWorkflowEmail({ to, subject, htmlContent, textContent });
};

export const sendClaimPaidEmail = async ({ to, employeeName, expenseId, category, amount, utrReference }) => {
  const formattedAmount = `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const subject = `[SpendX] Reimbursement Processed: ${formattedAmount} (Bank UTR: ${utrReference || 'Settled'})`;
  const textContent = `Hello ${employeeName || 'Employee'},\n\nPayment for your expense claim #${expenseId} (${category}) in the amount of ${formattedAmount} has been processed.\nBank UTR / Settlement Ref: ${utrReference || 'Completed'}\n\n- SVCORA SpendX`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #059669; padding: 20px; color: #ffffff; text-align: center;">
        <h2 style="margin: 0; font-size: 20px;">SVCORA SpendX</h2>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Payment Disbursed</p>
      </div>
      <div style="padding: 24px; color: #1e293b;">
        <p style="margin-top: 0;">Hello <strong>${employeeName || 'Employee'}</strong>,</p>
        <p>Your expense claim has been reimbursed and processed by Finance:</p>
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong>Claim ID:</strong> #${expenseId} (${category})</div>
          <div style="margin-bottom: 6px;"><strong>Disbursed Amount:</strong> <span style="font-size: 18px; font-weight: bold; color: #047857;">${formattedAmount}</span></div>
          <div style="margin-bottom: 0;"><strong>Bank Transfer UTR:</strong> <code style="font-weight: bold; background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">${utrReference || 'Settled / Direct Deposit'}</code></div>
        </div>
        <p style="font-size: 13px; color: #64748b;">The funds should reflect in your registered bank account according to standard banking clearing times.</p>
      </div>
      <div style="background: #f1f5f9; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
        SVC Infosystems &bull; Automated Workflow Notification
      </div>
    </div>
  `;

  return sendGenericWorkflowEmail({ to, subject, htmlContent, textContent });
};
