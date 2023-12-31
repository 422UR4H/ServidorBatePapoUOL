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


// SCHEMAS

const participantSchema = Joi.object({
    name: Joi.string().required().custom(value => stripHtml(value)).trim()
});
const messageSchema = Joi.object({
    to: Joi.string().custom(value => stripHtml(value)).trim().required(),
    from: Joi.string().custom(value => stripHtml(value)).trim().required(),
    text: Joi.string().custom(value => stripHtml(value)).trim().required(),
    type: Joi.string().custom(value => stripHtml(value)).required().valid("message", "private_message")
});


// ENDPOINTS

app.post("/participants", async (req, res) => {
    const { error, value } = participantSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }
    const name = value.name.result;

    try {
        if (await db.collection("participants").findOne({ name })) {
            return res.status(409).send("Nome de usuário já utilizado. Tente outro!");
        }
        const timestamp = Date.now();

        await db.collection("participants").insertOne({ name, lastStatus: timestamp });
        await db.collection("messages").insertOne(
            {
                from: name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: dayjs(timestamp).locale("pt-br").format("HH:mm:ss")
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
    const { error, value } = messageSchema.validate(
        { ...req.body, from: req.headers.user },
        { abortEarly: false }
    );
    if (error) return res.status(422).send(error.details.map(detail => detail.message));

    const from = value.from.result;
    const message = { from, to: value.to.result, text: value.text.result, type: value.type };

    try {
        if (!(await db.collection("participants").findOne({ name: from }))) {
            return res.status(422).send("Participante não conectado!");
        }
        const time = dayjs().locale("pt-br").format("HH:mm:ss");
        await db.collection("messages").insertOne({ ...message, time });
        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/messages", async (req, res) => {
    let limit = req.query.limit;

    if (limit) {
        limit = parseInt(stripHtml(limit).result);
        if (!limit || limit < 1) return res.sendStatus(422);
    }
    const from = stripHtml(req.headers.user).result;

    try {
        res.send(await db
            .collection("messages")
            .find({ $or: [{ to: { $in: ["Todos", from] } }, { type: "message" }, { from }] })
            .sort({ _id: -1 })
            .limit(limit ? limit : 0)
            .toArray());
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;
    if (!name) return res.sendStatus(404);

    try {
        const result = await db.collection("participants").updateOne(
            { name }, { $set: { lastStatus: Date.now() } }
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
        const message = await db.collection("messages").findOne({ _id: new ObjectId(id) });
        if (!message) return res.sendStatus(404);
        if (name !== message.from) return res.sendStatus(401);

        await db.collection("messages").deleteOne({ _id: new ObjectId(id) });
        res.sendStatus(204);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.put("/messages/:id", async (req, res) => {
    const { error, value } = messageSchema.validate(
        { ...req.body, from: req.headers.user },
        { abortEarly: false }
    );
    if (error) return res.status(422).send(error.details.map(detail => detail.message));

    const { id } = req.params;
    const from = value.from.result;
    const newMessage = { from, to: value.to.result, text: value.text.result, type: value.type };

    try {
        if (!(await db.collection("participants").findOne({ name: from }))) {
            return res.status(422).send("Participante não encontrado");
        }
        const message = await db.collection("messages").findOne({ _id: new ObjectId(id) });

        if (!message) return res.sendStatus(404);
        if (message.from !== from) return res.sendStatus(401);

        await db.collection("messages").updateOne(
            { _id: new ObjectId(id) },
            { $set: { ...newMessage, time: dayjs().locale("pt-br").format("HH:mm:ss") } }
        );
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
});


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));