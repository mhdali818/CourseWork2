const express = require('express'); // Express framework
const bodyParser = require('body-parser'); // Used for processing data in API requests
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors'); //Middleware for cors
const path = require('path');

const app = express();

const port = process.env.PORT || 3000; // AWS Elastic Beanstalk sets process.env.PORT


// This is for the logger middleware which logs all the incoming requests in the terminal
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} request to ${req.url}`);
  next();
});

const corsOptions = {
  origin: 'https://mhdali818.github.io/CourseWork2/', // Replace with your GitHub Pages URL
  optionsSuccessStatus: 200 //To make sure it runs on all devices including legacy ones
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Retrieve database connection string from environment variables
const dbConnectionString = process.env.DB_CONNECTION;
if (!dbConnectionString) {
  console.error('Database connection string is not set');
  process.exit(1); // Exit the app if database connection cant be established
}

let db;

// Connect to MongoDB
MongoClient.connect(dbConnectionString)
  .then(client => {
    console.log('Connected to Database');
    db = client.db('classlessons');
  })
  .catch(error => {
    console.error('Database connection error:', error);
    process.exit(1); // Exit the app if database connection cant be established
  });

app.use('/images', express.static(path.join(__dirname, 'images'))); //To load files from the images directory

app.get('/lessons', (req, res) => { //Route to get all the lessons
  db.collection('lessons').find().toArray()
    .then(lessons => {
      res.json(lessons); //Sending the lessons as json
    })
    .catch(error => {
      console.error('Error fetching lessons:', error);
      res.status(500).json({ error: 'An error occurred while fetching lessons.' });
    });
});
app.get('/orders', async (req, res) => { //Route for viewing all the orders
  try {
    const orders = await db.collection('orders').find().toArray();
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'An error occurred while fetching orders.' });
  }
});

app.post('/order', async (req, res) => { //Route for creating all the orders
  try {
    const orderResult = await db.collection('orders').insertOne({
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      items: req.body.items,
    });

    const updates = req.body.items.map(item => //To update the spaces which are available for the lessons
      db.collection('lessons').updateOne(
        { _id: new ObjectId(item.id) },
        { $inc: { spaces: -item.quantity } }
      )
    );

    await Promise.all(updates); //Over here it waits for everything to be updated

    res.json({ success: true, message: 'Order saved successfully', orderId: orderResult.insertedId });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'An error occurred while processing the order.' });
  }
});


app.put('/lessons/:id', (req, res) => {
  const lessonId = req.params.id;
  const spaces = req.body.spaces;

  db.collection('lessons').updateOne({ _id: new ObjectId(lessonId) }, { $set: { spaces: spaces } })
    .then(result => res.json({ success: true, message: 'Lesson updated successfully', result: result }))
    .catch(error => {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while updating the lesson.' });
    });
});



app.get('/lessons/:id', async (req, res) => { //Route to get a lesson by single id
  try {
    const lesson = await db.collection('lessons').findOne({ _id: new ObjectId(req.params.id) });
    if (lesson) {
      res.json(lesson);
    } else {
      res.status(404).json({ error: 'Lesson not found.' });
    }
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'An error occurred while fetching the lesson.' });
  }
});


app.get('/search', (req, res) => { // Route for search functionality
  const query = req.query.q;
  db.collection('lessons').find({ $text: { $search: query } }).toArray()
    .then(results => res.json(results))
    .catch(error => {
      console.error(error);
      res.status(500).json({ error: 'An error occurred during the search.' });
    });
});

// This is for the Middleware to handle non-existent routes
app.use((req, res, next) => {
  res.status(404).send('You are not in the right place!!');
});

// This is the Middelware for handling errors on the server
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.sendFile(path.join(__dirname, '../public/500.html'));
});

//Used to start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
