import fs from 'node:fs/promises';
// import type { MessageReceiver, MessageSender } from "@/main/hooks/messaging";
import { createLog } from '@nile/src/logging';
import { assertThat } from '@regist/regist';
import { type Attachment, Resend } from 'resend';

export type ChannelType = 'email' | 'sms' | 'push' | 'whatsapp';

export type MessageReceiver = {
  name: string;
  email: string;
  phone?: string;
};

export type MessageSender = {
  name: string;
  email: string;
  phone?: string;
};

export type Message = {
  channel: ChannelType;
  subject: string;
  content: string;
  other: {
    receivers: MessageReceiver[];
    attachments?: Attachment[];
    sender?: MessageSender;
  };
};

// export type Attachment = {
// 	path: string;
// 	filename?: string;
// };

type Payload = {
  subject: string;
  content: string;
  sender: MessageSender;
  receiver: MessageReceiver;
  attachments?: Attachment[];
};

export async function sendEmail(payload: Payload) {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not defined in the environment.');
  }

  const resend = new Resend(resendApiKey);

  const { subject, content, sender, receiver, attachments } = payload;

  let processedAttachments: Attachment[] | undefined;

  if (attachments?.length) {
    processedAttachments = await Promise.all(
      attachments.map(async (att) => {
        if ('content' in att && att.content) {
          return {
            filename: att.filename,
            content: att.content,
          };
        }

        if (
          'path' in att &&
          typeof att.path === 'string' &&
          assertThat(att.path).isUrl()
        ) {
          return {
            filename: att.filename,
            path: att.path,
          };
        }

        if ('path' in att && typeof att.path === 'string') {
          const fileBuffer = await fs.readFile(att.path);
          return {
            filename: att.filename,
            content: fileBuffer.toString('base64'),
          };
        }

        throw new Error('Invalid attachment format.');
      })
    );
  }

  const htmlContent = `
  <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 20px;
          background-color: #f8f9fa;
          color: #333;
        }
        .email-container {
          max-width: 580px;
          margin: 0 auto;
          background-color: white;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          padding: 32px 32px 24px;
          border-bottom: 1px solid #e9ecef;
        }
        .subject {
          font-size: 24px;
          font-weight: 600;
          color: #2c3e50;
          margin: 0;
          line-height: 1.3;
        }
        .content {
          padding: 32px;
        }
        .greeting {
          font-size: 16px;
          color: #495057;
          margin-bottom: 20px;
        }
        .message {
          font-size: 16px;
          color: #495057;
          margin-bottom: 28px;
        }
        .signature-section {
          border-top: 1px solid #e9ecef;
          padding-top: 20px;
        }
        .signature {
          color: #6c757d;
          font-size: 14px;
          margin: 0;
        }
        .sender-name {
          font-weight: 500;
          color: #495057;
        }
        .sender-email {
          color: #6c757d;
          font-size: 14px;
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1 class="subject">${subject}</h1>
        </div>
        <div class="content">
          <p class="greeting">Dear ${receiver.name},</p>
          <div class="message">${content}</div>
          
          <div class="signature-section">
            <p class="signature">Best regards,</p>
            <p class="sender-name">${sender.name}</p>
            <p class="sender-email">${sender.email}</p>
          </div>
        </div>
      </div>
    </body>
  </html>
`;

  const { data, error } = await resend.emails.send({
    from: sender.email,
    to: receiver.email,
    subject,
    html: htmlContent,
    attachments: processedAttachments,
  });

  if (error) {
    createLog({
      message: 'Error sending email',
      data: error,
      type: 'error',
      atFunction: 'sendEmail',
      appName: 'Resend',
    });
    throw error;
  }

  return { status: 'sent', data };
}

export const checkStatus = async (messageId: string) => {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not defined in the environment.');
  }

  const resend = new Resend(resendApiKey);

  const { data, error } = await resend.emails.get(messageId);

  if (error) {
    createLog({
      message: 'Error checking email status',
      data: error,
      type: 'error',
      atFunction: 'checkStatus',
      appName: 'Resend',
    });
    throw error;
  }

  return data;
};
