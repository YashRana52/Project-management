import sendEmail from "../configs/nodemailer.js";
import prisma from "../configs/prisma.js";
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "project-management" });

/* ---------------------------------------------------------
                    USER SYNC FUNCTIONS
----------------------------------------------------------*/

const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk" },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const u = event.data;

    await prisma.user.create({
      data: {
        id: u.id,
        email: u.email_addresses[0]?.email_address,
        name: `${u.first_name} ${u.last_name}`,
        image: u.image_url,
      },
    });
  }
);

const syncUserUpdation = inngest.createFunction(
  { id: "update-user-from-clerk" },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const u = event.data;

    await prisma.user.update({
      where: { id: u.id },
      data: {
        email: u.email_addresses[0]?.email_address,
        name: `${u.first_name} ${u.last_name}`,
        image: u.image_url,
      },
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-with-clerk" },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    await prisma.user.delete({
      where: { id: event.data.id },
    });
  }
);

/* ---------------------------------------------------------
                  WORKSPACE SYNC FUNCTIONS
----------------------------------------------------------*/

const syncWorkspaceCreation = inngest.createFunction(
  { id: "sync-workspace-from-clerk" },
  { event: "clerk/organization.created" },
  async ({ event }) => {
    const w = event.data;

    await prisma.workspace.create({
      data: {
        id: w.id,
        name: w.name,
        slug: w.slug,
        ownerId: w.created_by,
        image_url: w.image_url,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: w.created_by,
        workspaceId: w.id,
        role: "ADMIN",
      },
    });
  }
);

const syncWorkSpaceUpdation = inngest.createFunction(
  { id: "update-workspace-from-clerk" },
  { event: "clerk/organization.updated" },
  async ({ event }) => {
    const w = event.data;

    await prisma.workspace.update({
      where: { id: w.id },
      data: {
        name: w.name,
        slug: w.slug,
        image_url: w.image_url,
      },
    });
  }
);

const syncWorkspaceDeletion = inngest.createFunction(
  { id: "delete-workspace-with-clerk" },
  { event: "clerk/organization.deleted" },
  async ({ event }) => {
    await prisma.workspace.delete({
      where: { id: event.data.id },
    });
  }
);

/* ---------------------------------------------------------
             WORKSPACE MEMBER ADD (CORRECT EVENT)
----------------------------------------------------------*/

const syncWorkspaceMemberCreation = inngest.createFunction(
  { id: "sync-workspace-member-from-clerk" },
  { event: "clerk/organization.membership.created" },
  async ({ event }) => {
    const m = event.data;

    const userId = m.public_user_data.user_id;
    const workspaceId = m.organization.id;
    const role = m.role?.toUpperCase() || "MEMBER";

    let user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: m.public_user_data.email_address,
          name:
            m.public_user_data.first_name + " " + m.public_user_data.last_name,
          image: m.public_user_data.image_url,
        },
      });
    }

    await prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId,
        role,
      },
    });

    console.log("Workspace member synced:", { userId, workspaceId });
  }
);

/* ---------------------------------------------------------
             TASK EMAIL TEMPLATE (ASSIGNMENT)
----------------------------------------------------------*/

const taskAssignmentTemplate = ({
  assigneeName,
  taskTitle,
  dueDate,
  projectName,
  link,
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>Task Assigned</title>
  </head>
  <body style="font-family: Arial; background-color:#f4f4f4; padding:30px;">
    <div style="max-width:600px; margin:auto; background:white; padding:25px; border-radius:10px;">
      
      <h2 style="color:#2563eb;">New Task Assigned</h2>

      <p>Hi <strong>${assigneeName}</strong>,</p>

      <p>You have been assigned a new task in <b>${projectName}</b>.</p>

      <div style="background:#f0f9ff; padding:15px; border-left:4px solid #3b82f6; margin:15px 0;">
        <p><strong>Task:</strong> ${taskTitle}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      </div>

      <a href="${link}" style="padding:12px 20px; background:#2563eb; color:white; border-radius:6px; text-decoration:none;">
        View Task
      </a>

      <p style="margin-top:30px; color:#555;">
        Thanks,<br />
        <b>Project Management System</b>
      </p>

    </div>
  </body>
  </html>
  `;
};

/* ---------------------------------------------------------
             TASK REMINDER TEMPLATE
----------------------------------------------------------*/

const taskReminderTemplate = ({
  assigneeName,
  taskTitle,
  projectName,
  dueDate,
  link,
}) => {
  return `
  <!DOCTYPE html>
  <html>
  <body style="font-family: Arial; background:#f4f4f4; padding:30px;">
    <div style="max-width:600px; margin:auto; background:white; padding:25px; border-radius:10px;">
      <h2 style="color:#dc2626;">Task Reminder</h2>

      <p>Hi <strong>${assigneeName}</strong>,</p>

      <p>This is a reminder that the task assigned to you in <b>${projectName}</b> is still <b>not completed</b>.</p>

      <div style="background:#fff7ed; padding:15px; border-left:4px solid #f97316; margin:15px 0;">
        <p><strong>Task:</strong> ${taskTitle}</p>
        <p><strong>Due Date:</strong> ${dueDate}</p>
      </div>

      <a href="${link}" style="padding:12px 20px; background:#dc2626; color:white; border-radius:6px; text-decoration:none;">
        Complete Task
      </a>

      <p style="margin-top:30px; color:#555;">
        Thanks,<br/>
        <b>Project Management System</b>
      </p>
    </div>
  </body>
  </html>
  `;
};

/* ---------------------------------------------------------
             TASK ASSIGNMENT + REMINDER INNGEST
----------------------------------------------------------*/

const sendTaskAssignmentEmail = inngest.createFunction(
  { id: "send-task-assignment-mail" },
  { event: "app/task.assigned" },

  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    // Fetch task + user + project
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignee: true, project: true },
    });

    if (!task) return;

    // Send Assignment Email
    await sendEmail({
      to: task.assignee.email,
      subject: `New Task Assignment in ${task.project.name}`,
      html: taskAssignmentTemplate({
        assigneeName: task.assignee.name,
        taskTitle: task.title,
        dueDate: new Date(task.due_date).toLocaleDateString(),
        projectName: task.project.name,
        link: origin,
      }),
    });

    // Wait until Due Date for Reminder
    const dueDate = new Date(task.due_date);

    if (dueDate > new Date()) {
      await step.sleepUntil("wait-until-task-due", dueDate);

      // Re-check task completion
      const updatedTask = await prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: true, project: true },
      });

      if (updatedTask && updatedTask.status !== "DONE") {
        await sendEmail({
          to: updatedTask.assignee.email,
          subject: `Reminder: Task Pending in ${updatedTask.project.name}`,
          html: taskReminderTemplate({
            assigneeName: updatedTask.assignee.name,
            taskTitle: updatedTask.title,
            dueDate: new Date(updatedTask.due_date).toLocaleDateString(),
            projectName: updatedTask.project.name,
            link: origin,
          }),
        });
      }
    }
  }
);

/* ---------------------------------------------------------
                     EXPORT ALL FUNCTIONS
----------------------------------------------------------*/

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkSpaceUpdation,
  syncWorkspaceCreation,
  syncWorkspaceDeletion,
  syncWorkspaceMemberCreation,
  sendTaskAssignmentEmail,
];
