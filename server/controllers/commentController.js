import prisma from "../configs/prisma.js";

// Add Comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const { content, taskId } = req.body;

    // Check if task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if user is project member
    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: true },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const member = project.members.find((m) => m.userId === userId);
    if (!member) {
      return res
        .status(403)
        .json({ message: "You are not a member of this project" });
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        content,
      },
      include: {
        user: true, // comment ke sath user details bhi bhejo
      },
    });

    res.json({
      comment,
      message: "Comment added successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

//get commnets to task

export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: true },
    });

    res.json({
      comments,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
