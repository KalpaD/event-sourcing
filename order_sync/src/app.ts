import { Kafka, EachMessagePayload } from 'kafkajs';
import mysql, { Connection } from 'mysql';

interface EventData {
    orderId: string;
    eventType: string;
    revision : number;
    data: OrderData; // Assuming 'data' will hold order-related information
}

interface OrderData {
    orderId: string;
    orderStatus: string;
    paymentStatus: string;
    reviewStatus: string;
    readyToSend: boolean;
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

const consumer = kafka.consumer({ groupId: 'event-group' });

// Log event to the event_journal
const logEvent = async (eventData: EventData) => {
    const { orderId, eventType, data, revision } = eventData;
    const query = `INSERT INTO event_journal (entity_id, revision, agent, event_type, time_occurred, time_observed, data)
                   VALUES (?, ?, 'order_sync_app', ?, NOW(), NOW(), ?)`;
    db.query(query, [orderId, revision, eventType, JSON.stringify(data)], (err) => {
        if (err) console.error('Error logging event:', err);
        else console.log(`Event logged successfully for ${orderId} with revision ${revision}`);
    });
};

// Update approved_orders if conditions are met
async function updateApprovedOrders(eventData: EventData) {
    console.log(`Event in updateApprovedOrders: ${JSON.stringify(eventData)}`);
    console.log(`eventData.eventType: ${eventData.eventType}`);
    console.log(`eventData.data.paymentStatus: ${eventData.data.paymentStatus}`);

    // Check if there is an 'ORDER_CREATED' event for this order
    const checkOrderCreated = `SELECT COUNT(*) AS count FROM event_journal 
                               WHERE entity_id = ? AND event_type = 'order_events' 
                               AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.orderStatus')) = 'CREATED'`;

    db.query(checkOrderCreated, [eventData.orderId], (err, results) => {
        if (err) {
            console.error('Error checking for ORDER_CREATED event:', err);
            return;
        }

        if (results[0].count > 0) {
            // There is an ORDER_CREATED event, proceed with updating approved_orders
            console.log(`ORDER_CREATED exists for order ${eventData.orderId}, proceeding with approval.`);

            if (eventData.eventType === 'payment_events' && (eventData.data.paymentStatus === 'PAYMENT_AUTHORIZED' || eventData.data.paymentStatus === 'AUTHORIZATION_REVIEW_ACCEPTED')) {
                const insertOrUpdateApproved = `INSERT INTO approved_orders (order_id, data) VALUES (?, ?)
                                                ON DUPLICATE KEY UPDATE data = VALUES(data)`;

                db.query(insertOrUpdateApproved, [eventData.orderId, JSON.stringify(eventData.data)], (err) => {
                    if (err) {
                        console.error('Error updating approved orders:', err);
                    } else {
                        console.log(`Order ${eventData.orderId} updated in approved_orders.`);
                    }
                });
            } else {
                console.log(`Payment status is not authorized or under review for order ${eventData.orderId}. No update performed.`);
            }
        } else {
            console.log(`No ORDER_CREATED event found for order ${eventData.orderId}. Skipping update.`);
        }
    });
}

// Process messages from Kafka
const processMessage = async ({ topic, partition, message }: EachMessagePayload) => {
    const { key, value, timestamp } = message;

    if (value === null) {
        console.error(`Received null message on topic ${topic}`);
        return; // Skip processing for null message value
    }

    const data = JSON.parse(value.toString());
    const eventData = {
        orderId: data.orderId,
        eventType: topic,
        data: data,
        revision: data.revision  // Assume revision is part of the event data
    };

    await logEvent(eventData);
    await updateApprovedOrders(eventData);
};

// Run the consumer
const run = async (): Promise<void> => {
    await consumer.connect();
    await consumer.subscribe({ topic: 'order_events' });
    await consumer.subscribe({ topic: 'payment_events' });

    await consumer.run({
        eachMessage: processMessage
    });
};

run().catch(console.error);
