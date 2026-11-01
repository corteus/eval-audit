import twilio from 'twilio';

const client = twilio('sid', 'token');

export function notify(to: string) {
  return client.messages.create({ to, from: '+10000000000', body: 'Your order shipped' });
}
