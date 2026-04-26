// ---------------------------------------------------------------------------
// Unit Tests — email.service.js
// ---------------------------------------------------------------------------
const nodemailer = require('nodemailer');

const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

const { sendPasswordResetEmail, sendNotificationEmail } = require('src/services/email.service');

describe('sendPasswordResetEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends email with correct recipient and subject', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

    await sendPasswordResetEmail('user@test.com', 'https://app.com/reset?token=abc', 'John');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.to).toBe('user@test.com');
    expect(mailOptions.subject).toBe('Reset your FoodBridge password');
  });

  test('includes reset link in both text and HTML body', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-2' });
    const resetLink = 'https://app.com/reset?token=xyz&email=user@test.com';

    await sendPasswordResetEmail('user@test.com', resetLink, 'Jane');

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.text).toContain(resetLink);
    expect(mailOptions.html).toContain(resetLink);
  });

  test('includes first name in the greeting', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-3' });

    await sendPasswordResetEmail('user@test.com', 'https://reset.link', 'Alice');

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.text).toContain('Hi Alice');
    expect(mailOptions.html).toContain('Alice');
  });

  test('uses correct FROM address from environment variable', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-4' });

    await sendPasswordResetEmail('user@test.com', 'https://reset.link', 'Bob');

    const mailOptions = mockSendMail.mock.calls[0][0];
    expect(mailOptions.from).toBe(process.env.EMAIL_FROM);
  });

  test('throws error when sendMail fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

    await expect(
      sendPasswordResetEmail('user@test.com', 'https://reset.link', 'Eve'),
    ).rejects.toThrow('Failed to send password reset email');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sendNotificationEmail (generic notification template)
// ═══════════════════════════════════════════════════════════════════════════
describe('sendNotificationEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sends email with correct recipient and subject', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n1' });

    await sendNotificationEmail('user@test.com', 'John', {
      subject: 'New Claim', title: 'Someone claimed your listing', message: 'Hope Shelter claimed Fresh Veggies',
    });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.to).toBe('user@test.com');
    expect(mailOpts.subject).toBe('New Claim');
  });

  test('includes title and message in both text and HTML body', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n2' });

    await sendNotificationEmail('user@test.com', 'Jane', {
      subject: 'Delivery Complete', title: 'Your food was delivered!', message: 'Fresh Veggies was delivered to Hope Shelter',
    });

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.text).toContain('Your food was delivered!');
    expect(mailOpts.text).toContain('Fresh Veggies was delivered to Hope Shelter');
    expect(mailOpts.html).toContain('Your food was delivered!');
    expect(mailOpts.html).toContain('Fresh Veggies was delivered to Hope Shelter');
  });

  test('includes first name in the greeting', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n3' });

    await sendNotificationEmail('user@test.com', 'Alice', {
      subject: 'S', title: 'T', message: 'M',
    });

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.text).toContain('Hi Alice');
    expect(mailOpts.html).toContain('Alice');
  });

  test('includes FoodBridge branding in HTML', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n4' });

    await sendNotificationEmail('user@test.com', 'Bob', {
      subject: 'S', title: 'T', message: 'M',
    });

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.html).toContain('FoodBridge');
    expect(mailOpts.html).toContain('#38b2ac'); // green brand color
  });

  test('uses correct FROM address from environment variable', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n5' });

    await sendNotificationEmail('user@test.com', 'Bob', {
      subject: 'S', title: 'T', message: 'M',
    });

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.from).toBe(process.env.EMAIL_FROM);
  });

  test('does NOT throw when sendMail fails — swallows error', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

    await expect(
      sendNotificationEmail('user@test.com', 'Eve', { subject: 'S', title: 'T', message: 'M' }),
    ).resolves.not.toThrow();
  });

  test('falls back to title when subject is missing', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg-n6' });

    await sendNotificationEmail('user@test.com', 'Bob', {
      title: 'Fallback Title', message: 'M',
    });

    const mailOpts = mockSendMail.mock.calls[0][0];
    expect(mailOpts.subject).toBe('Fallback Title');
  });
});
