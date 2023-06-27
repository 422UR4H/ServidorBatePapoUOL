import express, { json } from "express";
import cors from "cors";


const PORT = 5000;
const app = express();

app.use(express());
app.use(cors());
app.use(json());


app.post("/participants", (req, res) => {
    const { name } = req.body;

    // validations

    // save in mongo

    res.sendStatus(201);
});

app.get("/participants", (req, res) => {
    console.log("test");
});

app.post("/messages", (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.User;

    // validations

    // save in mongo

    res.sendStatus(201);
});

app.get("/messages", (req, res) => {
    const limit = parseInt(req.query.limit);
    if (!limit || limit < 1) return res.sendStatus(422);
    
    const { User } = req.headers;

    // get messages

    // messages filter logic
    // limit filter
    // to, from and "Todos" filter

    // send messages filter data
});

app.post("/status", (req, res) => {
    const { User } = req.headers;
    if (!User) return res.sendStatus(404);

    // User validation => if (!participantsList.some(participant => participant.? === User)) return sendStatus(404);

    // update lastStatus of User using Date.now()

    res.sendStatus(200);
});


app.listen(PORT, () => console.log(`server is running on port ${PORT}`));