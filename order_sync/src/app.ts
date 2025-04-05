import { Kafka, EachMessagePayload } from 'kafkajs';
import mysql, { Connection } from 'mysql';
import axios from 'axios';

interface Order {
  order_id: string;
  order_status: string;
  payment_status: string;
  review_status: string;
  ready_to_send: boolean;
}

// MySQL connection
const db: Connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'rootpassword',
    database: 'event_synchronization'
});

db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

// Kafka configuration
const kafka = new Kafka({
    clientId: 'event_processor',
    brokers: ['localhost:9092']
});

const kconsumer = kafka.consumer({ groupId: 'event-group' });

// Function to send order to downstream application
async function sendOrder(orderId: string): Promise<void> {
    const selectQuery = `SELECT * FROM orders WHERE order_id='${orderId}' AND (order_status='CREATED' AND (payment_status='PAYMENT_AUTHORIZED' OR payment_status='AUTHORIZATION_REVIEW_ACCEPTED')) AND ready_to_send=FALSE;`;
    db.query(selectQuery, async (err, results: Order[]) => {
        if (err) throw err;
        if (results.length > 0) {
            try {
                const order = results[0];
                const response = await axios.post('http://localhost:3001/api/orders', order);
                if (response.status === 200) {
                    console.log(`Order ${orderId} sent successfully.`);
                    const updateQuery = `UPDATE orders SET ready_to_send=TRUE WHERE order_id='${orderId}';`;
                    db.query(updateQuery, (error) => {
                        if (error) throw error;
                        console.log(`Order ${orderId} marked as sent.`);
                    });
                }
            } catch (error) {
                console.error(`Failed to send order ${orderId}:`, error);
            }
        }
    });
}

// Function to process messages
const processMessage = async ({ topic, message }: EachMessagePayload): Promise<void> => {
    if (!message.value) {
        console.log(`Received message with null value in topic ${topic}`);
        return; // Exit if message value is null
    }

    console.log(`Received message from ${topic}: ${message.value.toString()}`);
    const eventData = JSON.parse(message.value.toString());
    const orderId = eventData.orderId;

    let query = '';
    if (topic === 'order_events') {
        const { orderStatus } = eventData;
        query = `INSERT INTO orders (order_id, order_status) VALUES ('${orderId}', '${orderStatus}')
                 ON DUPLICATE KEY UPDATE order_status='${orderStatus}';`;
    } else if (topic === 'payment_events') {
        const { paymentStatus, reviewStatus } = eventData;  
        query = `UPDATE orders SET payment_status='${paymentStatus}', review_status='${reviewStatus}'
                 WHERE order_id='${orderId}';`;
    }

    db.query(query, (err) => {
        if (err) throw err;
        console.log(`Database updated for order ${orderId}`);
        // Check and send the order if it meets the criteria
        sendOrder(orderId);
    });
};

// Running the consumers
const run = async (): Promise<void> => {
    await kconsumer.connect();
    await kconsumer.subscribe({ topic: 'order_events' });
    await kconsumer.subscribe({ topic: 'payment_events' });

    await kconsumer.run({
        eachMessage: processMessage,
    });

    
};

run().catch(console.error);
