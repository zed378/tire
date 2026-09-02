import { describe, expect, it } from 'vitest';
import { buildSenders, inAppSender, consoleEmailSender, resendEmailSender, unavailableWhatsappSender } from './senders.ts';

const ENVS = {
  DATABASE_URL: 'postgresql://localhost:5432/tire',
  STORAGE_SIGNING_KEY: 'test-signing-key',
  MFA_ENCRYPTION_KEY: 'test-mfa-key-32chars!!!!!',
};

function setupEnvs() {
  Object.entries(ENVS).forEach(([k, v]) => { process.env[k] = v; });
}
function teardownEnvs() {
  Object.keys(ENVS).forEach(k => delete process.env[k]);
}

describe('inAppSender', () => {
  it('has channel in_app', () => {
    expect(inAppSender.channel).toBe('in_app');
  });

  it('always returns ok:true', async () => {
    const result = await inAppSender.send({
      id: 1n,
      recipientId: 1n,
      recipientName: 'Test',
      recipientEmail: 'test@example.com',
      recipientPhone: null,
      channel: 'in_app',
      eventType: 'test.event',
      title: 'Test',
      body: 'Test body',
      link: null,
    });
    expect(result.ok).toBe(true);
    expect(result.externalId).toBeUndefined();
  });
});

describe('consoleEmailSender', () => {
  it('has channel email', () => {
    expect(consoleEmailSender.channel).toBe('email');
  });

  it('returns ok:true with console externalId', async () => {
    setupEnvs();
    try {
      const notification = {
        id: 42n,
        recipientId: 1n,
        recipientName: 'Test',
        recipientEmail: 'test@example.com',
        recipientPhone: null,
        channel: 'email',
        eventType: 'test.event',
        title: 'Test Subject',
        body: 'Test body',
        link: null,
      };
      const result = await consoleEmailSender.send(notification);
      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('console-42');
    } finally {
      teardownEnvs();
    }
  });
});

describe('resendEmailSender', () => {
  it('has channel email', () => {
    expect(resendEmailSender.channel).toBe('email');
  });

  it('returns error for missing email', async () => {
    setupEnvs();
    try {
      const result = await resendEmailSender.send({
        id: 1n,
        recipientId: 1n,
        recipientName: 'Test',
        recipientEmail: null,
        recipientPhone: null,
        channel: 'email',
        eventType: 'test',
        title: 'Test',
        body: 'Test',
        link: null,
      });
      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect((result as { error: string }).error).toBe('recipient has no email address');
    } finally {
      teardownEnvs();
    }
  });

  it('returns error for missing email (empty string)', async () => {
    setupEnvs();
    try {
      const result = await resendEmailSender.send({
        id: 1n,
        recipientId: 1n,
        recipientName: 'Test',
        recipientEmail: '',
        recipientPhone: null,
        channel: 'email',
        eventType: 'test',
        title: 'Test',
        body: 'Test',
        link: null,
      });
      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
    } finally {
      teardownEnvs();
    }
  });

  it('returns error for missing RESEND_API_KEY', async () => {
    const originalKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = '';
    setupEnvs();
    try {
      const result = await resendEmailSender.send({
        id: 1n,
        recipientId: 1n,
        recipientName: 'Test',
        recipientEmail: 'test@example.com',
        recipientPhone: null,
        channel: 'email',
        eventType: 'test',
        title: 'Test',
        body: 'Test',
        link: null,
      });
      expect(result.ok).toBe(false);
      expect(result.retryable).toBe(false);
      expect((result as { error: string }).error).toBe('RESEND_API_KEY is not configured');
    } finally {
      teardownEnvs();
      if (originalKey !== undefined) {
        process.env.RESEND_API_KEY = originalKey;
      } else {
        delete process.env.RESEND_API_KEY;
      }
    }
  });
});

describe('unavailableWhatsappSender', () => {
  it('has channel whatsapp', () => {
    expect(unavailableWhatsappSender.channel).toBe('whatsapp');
  });

  it('returns ok:false, not retryable', async () => {
    const result = await unavailableWhatsappSender.send({
      id: 1n,
      recipientId: 1n,
      recipientName: 'Test',
      recipientEmail: null,
      recipientPhone: '+628123456789',
      channel: 'whatsapp',
      eventType: 'test',
      title: 'Test',
      body: 'Test',
      link: null,
    });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect((result as { error: string }).error).toContain('not enabled');
  });
});

describe('buildSenders', () => {
  it('returns a Map with all channels', () => {
    setupEnvs();
    try {
      const senders = buildSenders();
      expect(senders.has('in_app')).toBe(true);
      expect(senders.has('email')).toBe(true);
      expect(senders.has('whatsapp')).toBe(true);
    } finally {
      teardownEnvs();
    }
  });

  it('returns in_appSender for in_app channel', () => {
    setupEnvs();
    try {
      const senders = buildSenders();
      expect(senders.get('in_app')).toBe(inAppSender);
    } finally {
      teardownEnvs();
    }
  });

  it('returns whatsapp sender for whatsapp channel', () => {
    setupEnvs();
    try {
      const senders = buildSenders();
      expect(senders.get('whatsapp')).toBe(unavailableWhatsappSender);
    } finally {
      teardownEnvs();
    }
  });
});
