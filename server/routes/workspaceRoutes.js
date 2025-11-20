import express from "express";
import {
  addMember,
  getUserWorkSpaces,
} from "../controllers/workspaceController.js";

const workspaceRouter = express.Router();

workspaceRouter.get("/", getUserWorkSpaces);
workspaceRouter.post("/add-member", addMember);

export default workspaceRouter;
