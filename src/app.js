import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";


// SETTINGS

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


// ENDPOINTS

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const nameSchema = joi.object({
        name: joi.string().required()
    });
    const validation = nameSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errorMessages = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }

    if (await db.collection("participants").findOne({ name })) { // se der errado, usar name: name
        return res.status(409).send("Nome de usuário já utilizado. Tente outro!");
    }

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

    if (!(await db.collection("participants").findOne({ name: from }))) {
        return res.status(422).send("Participante não conectado!");
    }

    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().required().allow("message", "private_message")
    });
    const validation = messageSchema.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errorMessages = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }

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
    let { limit } = req.query;

    if (limit) {
        limit = parseInt(limit);
        if (!limit || limit < 1) return res.sendStatus(422);
    } // talvez colocar um else com um novo valor pra ele

    const { User } = req.headers;

    // pesquisar sobre $or do mmongodb
    const messages = await db.collection("messages").find().toArray()
        .filter()   // messages filter logic
        .filter()   // limit filter
        .filter()   // to, from and "Todos" filter
        .filter(() => console.log());   // // send messages filter data

});

app.post("/status", async (req, res) => {
    const name = req.headers.User;
    if (!name) return res.sendStatus(404);

    if (!(await db.collection("participants").findOne({ name }))) return res.sendStatus(404);

    // update lastStatus of User using Date.now() with db.put

    res.sendStatus(200);
});


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));