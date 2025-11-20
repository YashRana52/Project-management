import prisma from "../configs/prisma.js";

// create project
export const createProject = async (req, res) => {
  try {
    const { userId } = await req.auth;

    const {
      workspaceId,
      description,
      name,
      status,
      start_date,
      end_date,
      team_members,
      team_lead,
      progress,
      priority,
    } = req.body;

    // Check if workspace exists and include members
    const workSpace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });

    if (!workSpace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // Check if user has ADMIN role in workspace
    const isAdmin = workSpace.members.some(
      (member) => member.userId === userId && member.role === "ADMIN"
    );
    if (!isAdmin) {
      return res.status(403).json({
        message:
          "You don't have permission to create project in this workspace",
      });
    }

    // Get team lead user ID using email
    const tamLead = team_lead
      ? await prisma.user.findUnique({
          where: { email: team_lead },
          select: { id: true },
        })
      : null;

    // Create project
    const project = await prisma.project.create({
      data: {
        workspaceId,
        name,
        description,
        status,
        priority,
        progress,
        team_lead: tamLead?.id || null,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    });

    // Add members to project if they exist in workspace
    if (team_members?.length > 0) {
      const membersToAdd = workSpace.members
        .filter((member) => team_members.includes(member.user.email))
        .map((member) => ({ projectId: project.id, userId: member.user.id }));

      if (membersToAdd.length > 0) {
        await prisma.projectMember.createMany({ data: membersToAdd });
      }
    }

    // Fetch project with members, tasks, and owner
    const projectWithMembers = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        members: { include: { user: true } },
        tasks: {
          include: { assignee: true, comments: { include: { user: true } } },
        },
        owner: true, // ensure 'owner' relation exists in Prisma schema
      },
    });

    res.json({
      project: projectWithMembers,
      message: "Project created successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: error.code || error.message || "Internal server error",
    });
  }
};

// update project
export const updateProject = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const {
      workspaceId,
      description,
      name,
      status,
      start_date,
      end_date,
      id,
      progress,
      priority,
    } = req.body;

    // Check if workspace exists
    const workSpace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { include: { user: true } } },
    });

    if (!workSpace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (
      !workSpace.members.some(
        (member) => member.userId === userId && member.role === "ADMIN"
      )
    ) {
      const project = await prisma.project.findUnique({
        where: { id },
      });

      if (!project) {
        return res.status(404).json({
          message: "project not found",
        });
      } else if (project.team_lead !== userId) {
        return res.status(403).json({
          message: "You don't have permission to update in this workspace",
        });
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        workspaceId,
        description,
        name,
        status,
        priority,
        progress,
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
      },
    });

    res.json({
      project,
      message: "Project updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

// add member to project
export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth;
    const { projectId } = req.params;
    const { email } = req.body;

    // check if user is project lead

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }
    if (project.team_lead !== userId) {
      return res
        .status(403)
        .json({ message: "Only project lead can add members" });
    }
    // check if user is already member in this project

    const existingMember = project.members.find(
      (member) => member.user.email === email
    );

    if (existingMember) {
      return res.status(404).json({ message: "User is already a members" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId,
      },
    });

    res.json({
      member,
      message: "Member added successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
