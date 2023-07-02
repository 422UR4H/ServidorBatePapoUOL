import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "@hapi/joi";
import { stripHtml } from "string-strip-html";
// import filterInactiveParticipants from "./filterInactiveParticipants.js";


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

// try {
//     filterInactiveParticipants();
// } catch (err) {
//     console.error("THE FILTER INACTIVE PARTICIPANTS IS NOT STARTED")
//     console.log(err.message);
// }


// ENDPOINTS

app.post("/participants", async (req, res) => {
    const nameSchema = joi.object({
        name: joi.string().required().custom(value => stripHtml(value)).trim()
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
        console.log(Date.now());
        console.log(dayjs().locale("pt-br"));
        await db.collection("messages").insertOne({
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().locale("pt-br").format("HH:mm:ss")
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
    const from = req.headers.user;
    if (!(await db.collection("participants").findOne({ name: from }))) {
        return res.status(422).send("Participante não conectado!");
    }

    const messageSchema = joi.object({
        to: joi.string().custom(value => stripHtml(value)).trim().required(),
        text: joi.string().custom(value => stripHtml(value)).trim().required(),
        type: joi.string().custom(value => stripHtml(value)).trim().required().allow("message", "private_message")
    });
    const { error, value } = messageSchema.validate(req.body, { abortEarly: false });

    if (error) {
        const errorMessages = error.details.map(detail => detail.message);
        return res.status(422).send(errorMessages);
    }
    const to = value.to.result;
    const text = value.text.result;
    const { type } = value;

    try {
        const time = dayjs().locale("pt-br").format("HH:mm:ss");
        await db.collection("messages").insertOne({ from, to, text, type, time });
        res.sendStatus(201);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    // let limit = stripHtml(req.query.limit) || null;
    let limit = req.query.limit;

    if (limit) {
        limit = parseInt(limit);
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


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));