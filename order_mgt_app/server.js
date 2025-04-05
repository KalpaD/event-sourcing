const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

app.post('/api/orders', (req, res) => {
    console.log('Received POST request:');
    console.log(req.body); // This will log the body of the POST request to the console
    res.status(200).send({ message: `Order id with id ${req.body.order_id} received` }); // Send a response back to the client
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Mock server running on http://localhost:${PORT}`);
});
