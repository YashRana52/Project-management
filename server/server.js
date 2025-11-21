import express from "express";
import "dotenv/config";
import cors from "cors";
import path from "path";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import workspaceRouter from "./routes/workspaceRoutes.js";
import { protect } from "./middlewares/auth.js";
import { ClerkExpressWithAuth } from "@clerk/clerk-sdk-node";
import projectRouter from "./routes/projectRoutes.js";
import taskRouter from "./routes/taskRoutes.js";
import commentsRouter from "./routes/commentsRoutes.js";

const app = express();
const __dirname = path.resolve();

// Clerk auth
app.use(ClerkExpressWithAuth());

// Middlewares
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

// Test route
app.get("/api/health", (req, res) => res.send("Server is live!"));

// Inngest webhook routes
app.use("/api/inngest", serve({ client: inngest, functions }));

// API routes
app.use("/api/workspaces", protect, workspaceRouter);
app.use("/api/projects", protect, projectRouter);
app.use("/api/tasks", protect, taskRouter);
app.use("/api/comments", protect, commentsRouter);

// ------------------- FRONTEND SERVE -------------------
// Static files from frontend build
app.use(express.static(path.join(__dirname, "frontend/dist")));

// SPA fallback (React Router)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/dist/index.html"));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
