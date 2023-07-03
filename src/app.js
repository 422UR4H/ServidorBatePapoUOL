import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import Joi from "@hapi/joi";
import { stripHtml } from "string-strip-html";
import { PORT, MS_INTERVAL } from "./constants.js";
import filterInactiveParticipants from "./filterInactiveParticipants.js";


// SETTINGS

const app = express();

app.use(express());
app.use(cors());
app.use(json());

dotenv.config();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
} catch (err) {
    console.log(err.message);
}
const db = mongoClient.db();

setInterval(filterInactiveParticipants, MS_INTERVAL, db);


// ENDPOINTS

app.post("/participants", async (req, res) => {
    const nameSchema = Joi.object({
        name: Joi.string().required().custom(value => stripHtml(value)).trim()
    });
    const { error, value } = nameSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }
    const name = value.name.result;

    try {
        if (await db.collection("participants").findOne({ name })) {
            return res.status(409).send("Nome de usuário já utilizado. Tente outro!");
        }

        await db.collection("participants").insertOne({ name, lastStatus: Date.now() });
        await db.collection("messages").insertOne(
            {
                from: name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: dayjs().locale("pt-br").format("HH:mm:ss")
            }
        );
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/participants", async (req, res) => {
    try {
        res.send(await db.collection("participants").find().toArray());
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/messages", async (req, res) => {
    const messageSchema = Joi.object({
        to: Joi.string().custom(value => stripHtml(value)).trim().required(),
        text: Joi.string().custom(value => stripHtml(value)).trim().required(),
        type: Joi.string().custom(value => stripHtml(value)).trim().required().valid("message", "private_message")
    });
    const { error, value } = messageSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }
    const to = value.to.result;
    const text = value.text.result;
    const { type } = value;
    const from = req.headers.user;

    try {
        if (!(await db.collection("participants").findOne({ name: from }))) {
            return res.status(422).send("Participante não conectado!");
        }
        const time = dayjs().locale("pt-br").format("HH:mm:ss");
        await db.collection("messages").insertOne({ from, to, text, type, time });
        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    let limit = req.query.limit;

    if (limit) {
        limit = parseInt(stripHtml(limit).result);
        if (!limit || limit < 1) return res.sendStatus(422);
    } else {
        limit = 0;
    }
    const user = req.headers.user;

    try {
        res.send(await db.collection("messages").find({
            $or: [
                { to: { $in: ["Todos", user] } },
                { type: "message" },
                { from: user }
            ]
        }).sort({ _id: -1 }).limit(limit).toArray());
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;
    if (!name) return res.sendStatus(404);

    try {
        const result = await db.collection("participants").updateOne(
            { name },
            { $set: { lastStatus: Date.now() } }
        )
        if (result.matchedCount === 0) return res.sendStatus(404);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.delete("/messages/:id", async (req, res) => {
    const name = req.headers.user;
    const id = stripHtml(req.params.id).result;

    try {
        const message = await db.collection("messages").findOne({ _id: ObjectId(id) });
        if (!message) return res.sendStatus(404);
        if (name !== message.from) return res.sendStatus(401);
        
        await db.collection("messages").deleteOne({ _id: ObjectId(id) });
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put("messages/:id", async (req, res) => {
    
});


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));