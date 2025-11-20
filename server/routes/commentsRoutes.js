import express from "express";
import {
  addComment,
  getTaskComments,
} from "../controllers/commentController.js";

const commentsRouter = express.Router();

commentsRouter.post("/", addComment);
commentsRouter.get("/:taskId", getTaskComments);

export default commentsRouter;
