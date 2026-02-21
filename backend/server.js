require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { initContract } = require("./config/contract");

// Route imports
const authRoutes = require("./routes/auth");
const campaignRoutes = require("./routes/campaigns");
const donateRoutes = require("./routes/donate");
const convertRoutes = require("./routes/convert");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/donations", donateRoutes);
app.use("/api/convert", convertRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// Start server
async function start() {
    try {
        // Connect to MongoDB
        await connectDB();

        // Initialize smart contract connection
        initContract();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}

start();
