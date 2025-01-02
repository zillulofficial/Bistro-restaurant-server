const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

// Custom middlewares
const cookieOption = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? 'none' : "strict",
  secure: process.env.NODE_ENV === "production" ? true : false
}
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token
  // console.log("token in the middleware: ", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" })
    }
    req.user = decoded
    next()
  })
}



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

    const userCollection = client.db('BistroBoss').collection('user')
    const menuCollection = client.db('BistroBoss').collection('menu')
    const reviewCollection = client.db('BistroBoss').collection('review')
    const cartCollection = client.db('BistroBoss').collection('cart')

    // middleware
    // use verify admin after verifying token
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email
      const query = { email: email }
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === "admin"
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden  access" })
      }
      next()
    }

    // JWT related API
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d'
      })
      res
        .cookie('token', token, cookieOption)
        .send({ success: true })
    })
    // token removal after user logs out
    app.post('/logout', async (req, res) => {
      const user = req.body
      res.clearCookie('token', { ...cookieOption, maxAge: 0 }).send({ success: true })
    })

    // user related API
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray()
      res.send(result)
    })
    // check for admin 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Forbidden  access" })
      }
      const query = { email: email }
      const user = await userCollection.findOne(query)
      let admin = false
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })
    app.post('/users', async (req, res) => {
      const user = req.body
      // insert email if it doesn't exist
      // it can be done in various ways (email unique, upsert, simple checking)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null })
      }
      const result = await userCollection.insertOne(user)
      res.send(result)
    })
    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })
    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "admin"
        }
      };
      const result = await userCollection.updateOne(filter, updateDoc)
      res.send(result)
    })


    // review related API
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find().toArray()
      res.send(result)
    })

    // menu related API
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray()
      res.send(result)
    })
    // load a single item via id
    app.get('/menu/:id', async(req, res)=>{
      const id= req.params.id
      const query= {_id: new ObjectId(id)}
      const result= await menuCollection.findOne(query)
      res.send(result)
    })
    // create menu items
    app.post('/menu', verifyToken,verifyAdmin, async(req, res)=>{
      const item = req.body
      const result= await menuCollection.insertOne(item)
      res.send(result)
    })
    app.patch('/menu/:id', async(req, res)=>{
      const item = req.body
      const id= req.params.id
      const filter= {_id: new ObjectId(id)}
      const options = { upsert: true };
      const updateDoc= {
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result= await menuCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    })
    // delete an item from the menu collection
    app.delete('/menu/:id', verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await menuCollection.deleteOne(query)
      res.send(result)
    })


    // cart related API
    // posting data to cart collection
    app.post('/carts', async (req, res) => {
      const item = req.body
      const result = await cartCollection.insertOne(item)
      res.send(result)
    })
    // getting all data from cart collection
    app.get('/carts', async (req, res) => {
      const email = req.query.email
      const query = { email: email }
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    // payment intent
    app.post('/create-payment-intent', async(req, res)=>{
      const {price}= req.body
      const amount= parseInt(price * 100)

      const paymentIntent= await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      })
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