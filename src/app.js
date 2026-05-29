import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";

import authRouter from "./routes/auth.routes.js";
import projectRouter from "./routes/project.routes.js";
import taskRouter from "./routes/task.routes.js";
import userRouter from "./routes/user.routes.js";
import { errorHandler, AppError } from "./middlewares/error.middleware.js";

const app = express();

// middlewares

app.use(cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(helmet());

// routers

app.use("/api/auth", authRouter);
app.use("/api/projects", projectRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/users", userRouter);

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Team Task Tracker API Running"
    });
});

// 404 handler
app.use((req, res, next) => {
    next(new AppError(404, "NOT_FOUND", `Endpoint ${req.originalUrl} does not exist`));
});

// global error handler
app.use(errorHandler);

export default app;