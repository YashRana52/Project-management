import prisma from "../configs/prisma.js";

// Get all workSpace for user
export const getUserWorkSpaces = async (req, res) => {
  try {
    const { userId } = await req.auth;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: userId },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: { include: { user: true } },
              },
            },
            members: { include: { user: true } },
            owner: true, // ✅ moved inside include
          },
        },
      },
    });

    res.json({ workspaces });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

//add member to workspace
export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    //check if user already exist

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!workspaceId || !role) {
      return res.status(400).json({ message: "missing required parameter" });
    }

    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res.status(400).json({ message: "invalid role" });
    }

    //fetch workspace

    const workSpace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workSpace) {
      return res.status(404).json({ message: "WorkSpace not found" });
    }

    //check creater has admin role

    if (
      !workSpace.members.find(
        (member) => member.userId === userId && member.role === "ADMIN"
      )
    ) {
      return res
        .status(404)
        .json({ message: "You do not have admin previleges" });
    }

    // check if user is already member
    const existingMember = workSpace.members.find(
      (member) => member.userId === user.id
    );

    if (existingMember) {
      return res.status(401).json({ message: "user already a member" });
    }
    const member = await prisma.workspaceMember.create({
      data: { userId: user.id, workspaceId, role, message },
    });

    res.json({ member, message: "member added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
