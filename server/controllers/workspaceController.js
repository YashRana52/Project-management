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
        owner: true,
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
            owner: true,
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

    // check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!workspaceId || !role)
      return res.status(400).json({ message: "missing required parameter" });

    if (!["ADMIN", "MEMBER"].includes(role))
      return res.status(400).json({ message: "invalid role" });

    // fetch workspace
    const workSpace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });
    if (!workSpace)
      return res.status(404).json({ message: "WorkSpace not found" });

    // check if current user is admin
    const isAdmin = workSpace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN"
    );
    if (!isAdmin)
      return res
        .status(403)
        .json({ message: "You do not have admin privileges" });

    // check if user is already a member
    const existingMember = workSpace.members.find(
      (member) => member.userId === user.id
    );
    if (existingMember)
      return res.status(400).json({ message: "User already a member" });

    // add member with proper relation
    const member = await prisma.workspaceMember.create({
      data: {
        user: { connect: { id: user.id } },
        workspace: { connect: { id: workspaceId } },
        role,
        message,
      },
      include: { user: true, workspace: true },
    });

    res.json({ member, message: "Member added successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
