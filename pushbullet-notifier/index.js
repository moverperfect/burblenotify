import { Kafka } from 'kafkajs';
import PushBullet from 'pushbullet';

const kafka = new Kafka({
  clientId: 'pushbullet-notifier-1',
  brokers: ['broker:29092'],
});

const API_KEY = process.env.PB_API_KEY;

const listeners = [
  {
    jumperName: 'Full Name 1',
    timeLeft: 25,
    platformKey: 'sdfd',
  },
  {
    jumperName: 'Full Name 2',
    timeLeft: 20,
    platformKey: 'sdfsd',
  },
];

const consumer = kafka.consumer({ groupId: 'pushbullet' });

await consumer.connect();
await consumer.subscribe({ topic: 'loadChanges', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const parsedMessage = JSON.parse(message.value.toString());

    listeners.forEach(async (listener) => {
      if (
        listener.jumperName === parsedMessage.jumperName &&
        listener.timeLeft === parsedMessage.timeLeft
      ) {
        const pusher = new PushBullet(API_KEY);

        await pusher.note(
          listener.platformKey,
          parsedMessage.loadName,
          `${listener.timeLeft} minutes until your load!`,
          (err, response) => {
            if (err) {
              console.error('Pushbullet error:', err);
            } else {
              console.log('Pushbullet sent:', response);
            }
          }
        );
      }
    });
  },
});
