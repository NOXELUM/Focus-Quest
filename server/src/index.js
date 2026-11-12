import express from "express";

const app = express();

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Xin chào" });
});

app.listen(3001, () => {
  console.log("Server run at http://localhost:3001");
});
