const mysql = require('mysql');
const axios = require('axios');

// Configure MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'rootpassword',
    database: 'event_synchronization'
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL successfully.');
});

// Function to process approved orders
const processApprovedOrders = () => {
    // Only fetch orders that have not been sent
    const query = 'SELECT * FROM approved_orders WHERE is_sent = 0';
    db.query(query, async (err, results) => {
        if (err) {
            console.error('Error fetching approved orders:', err);
            return;
        }

        for (let order of results) {
            try {
                const response = await axios.post('http://localhost:3001/api/orders', JSON.parse(order.data));
                if (response.status === 200) {
                    console.log(`Order ${order.order_id} sent successfully.`);
                    // Update the is_sent flag
                    const updateQuery = 'UPDATE approved_orders SET is_sent = 1 WHERE order_id = ?';
                    db.query(updateQuery, [order.order_id], err => {
                        if (err) {
                            console.error('Error updating is_sent flag:', err);
                        }
                    });
                } else {
                    console.log(`Failed to send order ${order.order_id}, status code: ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to send order ${order.order_id}:`, error);
            }
        }
    });
};

// Run the processing function periodically
setInterval(processApprovedOrders, 10000);  // 10 seconds interval

// Handle process exit
process.on('SIGINT', () => {
    db.end(err => {
        if (err) {
            console.error('Error closing MySQL connection:', err);
        }
        console.log('MySQL connection closed.');
        process.exit(0);
    });
});
