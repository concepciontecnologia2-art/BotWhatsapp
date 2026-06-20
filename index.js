require("dotenv").config();
const express = require("express");
const webhookRouter = require("./webhook");

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Bot Concepción Tecnología ✅"));
app.use("/webhook", webhookRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🤖 Bot corriendo en puerto ${PORT}`));