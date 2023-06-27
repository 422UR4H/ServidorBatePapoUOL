import express, { json } from "express";
import cors from "cors";


const PORT = 5000;
const app = express();

app.use(express());
app.use(cors());
app.use(json());

app.get("/test", (req, res) => {
    console.log("test");
});



app.listen(PORT, () => console.log(`server is running on port ${PORT}`));