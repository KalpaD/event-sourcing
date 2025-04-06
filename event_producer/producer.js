const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092']  // Adjust this if your Kafka broker is not on localhost
});

const producer = kafka.producer();

const run = async () => {
  await producer.connect();

  const args = process.argv.slice(2); // Get command-line arguments

  // Handling command-line arguments
  for (let i = 0; i < args.length; i += 3) {
    const arg = args[i];     // Event type code
    const orderId = args[i + 1]; // Order ID
    const revision = args[i + 2]; // Revision number

    // Check if all needed arguments are provided
    if (!arg || !orderId || !revision) {
        console.error('Missing arguments. Usage: node producer.js <event_code> <order_id> <revision>');
        process.exit(1);
    }

    if (!orderId) {
      console.error(`Order ID missing for event type ${arg}`);
      continue;
    }

    switch (arg) {
      case 'o': // ORDER_CREATED
        await producer.send({
          topic: 'order_events',
          messages: [{ value: JSON.stringify({ eventType: 'ORDER', orderId: `${orderId}`, revision: `${revision}`, orderStatus : 'CREATED', timestamp: new Date().toISOString() }) }],
        });
        console.log('ORDER_CREATED event sent');
        break;
      case 'pa': // PAYMENT_AUTHORIZED
        await producer.send({
          topic: 'payment_events',
          messages: [{ value: JSON.stringify({ eventType: 'PAYMENT', paymentStatus: 'PAYMENT_AUTHORIZED', orderId: `${orderId}`, revision: `${revision}`, timestamp: new Date().toISOString() }) }],
        });
        console.log('PAYMENT_AUTHORIZED event sent');
        break;
      case 'par': // PAYMENT_AUTH_WITHPENDING_REVIEW
        await producer.send({
          topic: 'payment_events',
          messages: [{ value: JSON.stringify({ eventType: 'PAYMENT', paymentStatus: 'PAYMENT_AUTH_WITHPENDING_REVIEW', orderId: `${orderId}`, revision: `${revision}`, timestamp: new Date().toISOString() }) }],
        });
        console.log('PAYMENT_AUTH_WITHPENDING_REVIEW event sent');
        break;
      case 'paa': // AUTHORIZATION_REVIEW_ACCEPTED
        await producer.send({
          topic: 'payment_events',
          messages: [{ value: JSON.stringify({ eventType: 'PAYMENT', paymentStatus: 'AUTHORIZATION_REVIEW_ACCEPTED', orderId: `${orderId}`, revision: `${revision}`, timestamp: new Date().toISOString() }) }],
        });
        console.log('AUTHORIZATION_REVIEW_ACCEPTED event sent');
        break;
      case 'pad': // AUTHORIZATION_REVIEW_DECLINED
        await producer.send({
          topic: 'payment_events',
          messages: [{ value: JSON.stringify({ eventType: 'PAYMENT',paymentStatus: 'AUTHORIZATION_REVIEW_DECLINED', orderId: `${orderId}`, revision: `${revision}`,  timestamp: new Date().toISOString() }) }],
        });
        console.log('AUTHORIZATION_REVIEW_DECLINED event sent');
        break;
    }
  }

  await producer.disconnect();
  console.log('Producer disconnected');
};

run().catch(console.error);
