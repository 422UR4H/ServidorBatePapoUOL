import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";


const PORT = 5000;
const app = express();

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
} catch (err) {
    console.log(err.message);
}
const db = mongoClient.db();

app.use(express());
app.use(cors());
app.use(json());


app.post("/participants", async (req, res) => {
    const { name } = req.body;

    // validations with joi lib
    const schemaName = joi.object({
        name: joi.string().required()
    })
    const validation = schemaName.validate(req.body, { abortEarly: false });

    try {
        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });
        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: 'HH:mm:ss' // utilizar dayjs aqui
        });
        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/participants", async (req, res) => {
    try {
        res.send(await db.collection("participants").find().toArray());
    } catch (err) {
        console.log(err.message);
        res.status(500);
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.User;

    // validations with joi lib and MongoDB functions

    try {
        const time = 0; // dayjs
        await db.collection("messages").insertOne({ from, to, text, type, time });
        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    // if (!limit) 
    if (limit < 1) return res.sendStatus(422);

    const { User } = req.headers;

    const messages = await db.collection("messages").find().toArray()
        .filter()   // messages filter logic
        .filter()   // limit filter
        .filter()   // to, from and "Todos" filter
        .filter(() => console.log());   // // send messages filter data


});

app.post("/status", (req, res) => {
    const { User } = req.headers;
    if (!User) return res.sendStatus(404);

    // User validation => if (!participantsList.some(participant => participant.? === User)) return sendStatus(404);

    // update lastStatus of User using Date.now()

    res.sendStatus(200);
});


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));