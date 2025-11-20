import sendEmail from "../configs/nodemailer.js";
import prisma from "../configs/prisma.js";
import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

//inngest func to save user data to a databse

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
  },
  { event: "clerk/user.created" },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.create({
      data: {
        id: data.id,
        email: data?.email_addresses[0]?.email_address,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  }
);

//inngest func to delete user data to a databse
const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-with-clerk",
  },
  { event: "clerk/user.deleted" },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.delete({
      where: {
        id: data.id,
      },
    });
  }
);

//inngest func to update user data to a databse

const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
  },
  { event: "clerk/user.updated" },
  async ({ event }) => {
    const { data } = event;
    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: data?.email_addresses[0]?.email_addresses,
        name: data?.first_name + " " + data?.last_name,
        image: data?.image_url,
      },
    });
  }
);

//inngest func to save workspace  to a databse

const syncWorkspaceCreation = inngest.createFunction(
  { id: "sync-workspace-from-clerk" },
  { event: "clerk/organization.created" },
  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });
    // Add creator as admin member

    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "ADMIN",
      },
    });
  }
);

//inngest func to update workspace  data in databse

const syncWorkSpaceUpdation = inngest.createFunction(
  { id: "update-workspace-from-clerk" },
  { event: "clerk/organization.updated" },

  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.update({
      where: {
        id: data.id,
      },
      data: {
        name: data.name,
        slug: data.slug,

        image_url: data.image_url,
      },
    });
  }
);

//inngest func to delete  workspace from  databse

const syncWorkspaceDeletion = inngest.createFunction(
  { id: "delete-workspace-with-clerk" },
  { event: "clerk/organization.deleted" },

  async ({ event }) => {
    const { data } = event;

    await prisma.workspace.delete({
      where: { id: data.id },
    });
  }
);

//inngest func to save  workspace member data to a databse

const syncWorkspaceMemberCreation = inngest.createFunction(
  { id: "sync-workspace-with-clerk" },
  { event: "clerk/organization.accepted" },

  async ({ event }) => {
    const { data } = event;

    await prisma.workspaceMember.create({
      data: {
        userId: data.user_id,
        workspaceId: data.organization_id,
        role: String(data.role_name).toUpperCase(),
      },
    });
  }
);

//inngest func to  send email on task creation

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
  <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
      
      <h2 style="color:#2563eb;">New Task Assigned</h2>

      <p>Hi <strong>${assigneeName}</strong>,</p>

      <p>You have been assigned a new task in <b>${projectName}</b>.</p>

      <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; border-radius: 6px;">
        <p style="margin: 0;"><strong>Task:</strong> ${taskTitle}</p>
        <p style="margin: 0;"><strong>Due Date:</strong> ${dueDate}</p>
      </div>

      <a href="${link}" style="display:inline-block; padding: 12px 20px; background:#2563eb; color:white; text-decoration:none; border-radius:6px; font-weight:bold;">
        View Task
      </a>

      <p style="margin-top: 30px; color: #555;">
        Thanks,<br />
        <b>Project Management System</b>
      </p>

    </div>
  </body>
  </html>
  `;
};

//task reminder template
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
  <body style="font-family: Arial; background:#f4f4f4; padding: 30px;">
    <div style="max-width: 600px; margin:auto; background:white; padding:25px; border-radius:10px;">
      <h2 style="color:#dc2626;">Task Reminder</h2>

      <p>Hi <strong>${assigneeName}</strong>,</p>

      <p>This is a reminder that the task assigned to you in <b>${projectName}</b> is still <b>not completed</b>.</p>

      <div style="background: #fff7ed; padding: 15px; border-left: 4px solid #f97316; margin: 15px 0; border-radius: 6px;">
        <p style="margin: 0;"><strong>Task:</strong> ${taskTitle}</p>
        <p style="margin: 0;"><strong>Due Date:</strong> ${dueDate}</p>
      </div>

      <a href="${link}" style="padding: 12px 20px; background:#dc2626; color:white; border-radius:6px; text-decoration:none;">
        Complete Task
      </a>

      <p style="margin-top: 30px; color: #555;">
        Thanks,<br/>
        <b>Project Management System</b>
      </p>
    </div>
  </body>
  </html>
  `;
};

// MAIN INNGEST FUNCTION

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

    // Wait till Due Date for Reminder

    const dueDate = new Date(task.due_date);

    // Check: future date hi ho
    if (dueDate > new Date()) {
      await step.sleepUntil("wait-until-task-due", dueDate);

      //  Check task completion

      await step.run("check-task-completion", async () => {
        const updatedTask = await prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true },
        });

        if (!updatedTask) return;

        // If NOT completed → send Reminder Email
        if (updatedTask.status !== "DONE") {
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
      });
    }
  }
);

// Create an empty array where we'll export future Inngest functions
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
