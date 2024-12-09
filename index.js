const express = require('express');
const cors = require('cors');
const jwt= require('jsonwebtoken')
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.port || 9000
const app = express()

// middlewares
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionsSuccessStatus: 200
  }))
app.use(express.json())
app.use(cookieParser())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.awpu5n8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    
    const menuCollection = client.db('BistroBoss').collection('menu')
    const reviewCollection = client.db('BistroBoss').collection('review')
    const cartCollection = client.db('BistroBoss').collection('cart')

    // menu related API
    app.get('/menu', async(req, res)=>{
        const result = await menuCollection.find().toArray()
        res.send(result)
    })

    // review related API
    app.get('/review', async(req, res)=>{
        const result = await reviewCollection.find().toArray()
        res.send(result)
    })

    // cart related API
    // posting data to cart collection
    app.post('/carts', async(req, res)=>{
      const item= req.body
      const result= await cartCollection.insertOne(item)
      res.send(result)
    })
    // getting all data from cart collection
    app.get('/carts', async(req, res)=>{
      const email= req.query.email
      const query= {email: email}
      const result = await cartCollection.find(query).toArray()
      res.send(result)
  })
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Bistro Boss Server running smoothly!')
  })
  app.listen(port, () => console.log(`Server Running at port: ${port}`))