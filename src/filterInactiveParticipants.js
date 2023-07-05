import dayjs from "dayjs";
import { MS_STATUS } from "./constants.js";


export default async function filterInactiveParticipants(db) {
    try {
        const MS_DIFF = Date.now() - MS_STATUS;
        const inactiveParticipants = await db.collection("participants").find(
            { lastStatus: { $lt: MS_DIFF } }
        ).toArray();

        if (inactiveParticipants.length < 1) return;

        await db.collection("participants").deleteMany(
            { lastStatus: { $lt: MS_DIFF } }
        );

        await db.collection("messages").insertMany(inactiveParticipants.map((p) => {
            return {
                from: p.name,
                to: "Todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().locale("pt-br").format("HH:mm:ss")
            };
        }));
    } catch (err) {
        console.log(err.message);
    }
}