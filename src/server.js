import "dotenv/config";
import app from "./app.js";
import connectDB from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port http://localhost:${PORT}`);
        })
    } catch (error) {
        console.log("Error while starting server", error);
        process.exit(1);
    }
}

startServer();