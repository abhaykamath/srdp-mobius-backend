const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const getSprints = require("./APIs/get-all-sprints-for-a-board");
const getSprintIssues = require("./APIs/get-all-issues-for-a-sprint");

const app = express();
const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get("/health", async (req, res) => {
  res.json({ message: "ok" });
});

// APIs for React

app.get("/:boardId/allSprints", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  let sprints = data.values;
  res.json(sprints);
});

app.get("/:boardId/activeSprint", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  const active_sprint = data.values.filter(
    (sprint) => sprint.state === "active"
  );
  if (active_sprint.length === 0) {
    const closed_sprints = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    res.json({ active_sprint: closed_sprints[closed_sprints.length - 1] });
  } else {
    res.json({
      active_sprint: active_sprint[0],
    });
  }
});

app.get("/sprint/:sprintId/stories", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const response = await getSprintIssues(sprint_id);
  const issues = response.issues
    .filter((issue) => issue.fields.issuetype.name === "Story")
    .map((issue) => {
      return {
        story_id: issue.id,
        story_name: issue.fields.summary,
        story_type: issue.fields.issuetype.name,
        story_status: issue.fields.status.statusCategory.name,
        project_id: issue.fields.project.id,
        project_name: issue.fields.project.name,
        status_name: issue.fields.status.name,
        sprint_id: issue.fields.customfield_10018[0].id.toString(),
        story_ac_hygiene: issue.fields.customfield_10157 ? "YES" : "NO",
        original_estimate:
          issue.fields.timetracking.originalEstimate || "Not added",
        remaining_estimate:
          issue.fields.timetracking.remainingEstimate || "Not added",
        time_spent: issue.fields.timetracking.timeSpent || "Not added",
        story_reviewers: issue.fields.customfield_10003
          ? issue.fields.customfield_10003.length !== 0
            ? issue.fields.customfield_10003
                .map((r, i) => r.displayName)
                .join(", ")
            : "Reviewers not added"
          : "Reviewers not added",
      };
    });
  res.json({ issues });
});

app.get("/sprint/:sprintId/progress", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const data = await getSprintIssues(sprint_id);
  const story_subtask_map = {};
  const issues = data.issues;
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Story") {
      if (!story_subtask_map[issue.id]) {
        story_subtask_map[issue.id] = {
          number_of_sub_tasks: 0,
          completed_sub_tasks: 0,
          story_id: issue.id,
          story_name: issue.fields.summary,
          project_id: issue.fields.project.id,
          sprint_id: issue.fields.customfield_10018[0].id.toString(),
          story_points: 0,
        };
      }
    }
  }
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Sub-task") {
      if (issue.fields.parent) {
        const parent_id = issue.fields.parent.id;
        if (story_subtask_map[parent_id]) {
          story_subtask_map[parent_id].number_of_sub_tasks++;
          if (issue.fields.customfield_10020) {
            story_subtask_map[parent_id].story_points +=
              issue.fields.customfield_10020;
          }
          if (issue.fields.status.name === "Done") {
            story_subtask_map[parent_id].completed_sub_tasks++;
          }
        }
      }
    }
  }
  const values = Object.values(story_subtask_map);
  res.json({
    sprint_progress: values,
  });
});

app.get("/sprint/:sprintId/subtasks/progress", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const data = await getSprintIssues(sprint_id);
  const status_category_map = {};
  const issues = data.issues;
  const sub_tasks = issues
    .filter((i) => i.fields.issuetype.name === "Sub-task")
    .map((i) => {
      return {
        issue_id: i.id,
        issue_type: i.fields.issuetype.name,
        story_id: i.fields.parent.id,
        status_category_name: i.fields.status.statusCategory.name,
        issue_name: i.fields.summary,
      };
    });
  for (let subtask of sub_tasks) {
    const key = subtask.story_id + subtask.status_category_name;
    if (!status_category_map[key]) {
      status_category_map[key] = {
        story_id: subtask.story_id,
        status_category_name: subtask.status_category_name,
        issue_count: 1,
      };
    } else {
      status_category_map[key].issue_count++;
    }
  }
  const values = Object.values(status_category_map);
  res.json({
    values,
  });
});

app.get("/sprint/:sprintId/members", async (req, res) => {
  const sprint_id = req.params.sprintId;
  const data = await getSprintIssues(sprint_id);
  const issues = data.issues;
  let names = new Set();
  let members = [];
  for (let issue of issues) {
    if (issue.fields.issuetype.name !== "Story") {
      if (issue.fields.assignee) {
        let name = issue.fields.assignee.displayName;
        if (!names.has(name)) {
          let member = {
            sprint_member_account_id:
              issue.fields.assignee.accountId.toString(),
            sprint_member_full_name: issue.fields.assignee.displayName,
            sprint_member_card_name: issue.fields.assignee.displayName
              .substring(0, 2)
              .toUpperCase(),
          };
          members.push(member);
          names.add(name);
        }
      }
    }
  }
  res.json({
    members,
  });
});

// APIs for PI

app.get("/:boardID/activeSprint/stories", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getSprints(board_id);
  let sprint_id = "";
  let sprint_start = "";
  let sprint_end = "";
  let active_sprint = data.values.filter((sprint) => sprint.state === "active");
  if (active_sprint.length === 0) {
    const active_sprint = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    active_sprint = active_sprint[active_sprint.length - 1][0];
  } else {
    active_sprint = active_sprint[0];
  }
  sprint_id = active_sprint.id.toString();
  sprint_name = active_sprint.name;
  sprint_start = active_sprint.startDate.substring(0, 10);
  sprint_end = active_sprint.endDate.substring(0, 10);
  const sprint_issues = await getSprintIssues(sprint_id);
  const stories = sprint_issues.issues
    .filter((issue) => issue.fields.issuetype.name === "Story")
    .map((issue) => {
      return {
        board_id,
        sprint_id,
        sprint_name,
        sprint_start,
        sprint_end,
        story_id: issue.id,
        story_name: issue.fields.summary,
        story_type: issue.fields.issuetype.name,
        story_status: issue.fields.status.statusCategory.name,
        project_id: issue.fields.project.id,
        project_name: issue.fields.project.name,
        status_name: issue.fields.status.name,
        sprint_id: issue.fields.sprint.id.toString(),
        story_ac_hygiene: issue.fields.customfield_10157 ? "YES" : "NO",
        original_estimate:
          issue.fields.timetracking.originalEstimate || "Not added",
        remaining_estimate:
          issue.fields.timetracking.remainingEstimate || "Not added",
        time_spent: issue.fields.timetracking.timeSpent || "Not added",
        story_reviewers: issue.fields.customfield_10003
          ? issue.fields.customfield_10003.length !== 0
            ? issue.fields.customfield_10003
                .map((r, i) => r.displayName)
                .join(", ")
            : "Reviewers not added"
          : "Reviewers not added",
      };
    });
  res.json({
    stories,
  });
});

app.get("/:boardID/activeSprint/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getSprints(board_id);
  let sprint_id = "";
  let active_sprint = data.values.filter((sprint) => sprint.state === "active");
  if (active_sprint.length === 0) {
    const active_sprint = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    active_sprint = active_sprint[active_sprint.length - 1][0];
  } else {
    active_sprint = active_sprint[0];
  }
  sprint_id = active_sprint.id.toString();
  const issues_data = await getSprintIssues(sprint_id);
  const story_subtask_map = {};
  const issues = issues_data.issues;
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Story") {
      if (!story_subtask_map[issue.id]) {
        story_subtask_map[issue.id] = {
          number_of_sub_tasks: 0,
          completed_sub_tasks: 0,
          story_id: issue.id,
          story_name: issue.fields.summary,
          project_id: issue.fields.project.id,
          sprint_id: issue.fields.sprint.id,
          story_points: 0,
        };
      }
    }
  }
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Sub-task") {
      if (issue.fields.parent) {
        const parent_id = issue.fields.parent.id;
        if (story_subtask_map[parent_id]) {
          story_subtask_map[parent_id].number_of_sub_tasks++;
          if (issue.fields.customfield_10020) {
            story_subtask_map[parent_id].story_points +=
              issue.fields.customfield_10020;
          }
          if (issue.fields.status.name === "Done") {
            story_subtask_map[parent_id].completed_sub_tasks++;
          }
        }
      }
    }
  }
  let values = Object.values(story_subtask_map);
  values = values.map((v) => {
    return {
      number_of_sub_tasks: v.number_of_sub_tasks.toString(),
      completed_sub_tasks: v.completed_sub_tasks.toString(),
      story_id: v.story_id,
      story_name: v.story_name,
      project_id: v.project_id,
      sprint_id: v.sprint_id.toString(),
      story_points: v.story_points.toString(),
      board_id: v.board_id,
    };
  });
  res.json({
    sprint_progress: values,
  });
});

app.get("/:boardID/activeSprint/story/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getSprints(board_id);
  let sprint_id = "";
  let active_sprint = data.values.filter((sprint) => sprint.state === "active");
  if (active_sprint.length === 0) {
    const active_sprint = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    active_sprint = active_sprint[active_sprint.length - 1][0];
  } else {
    active_sprint = active_sprint[0];
  }
  sprint_id = active_sprint.id.toString();
  const sprint_issues = await getSprintIssues(sprint_id);
  const status_category_map = {};
  const issues = sprint_issues.issues;
  const sub_tasks = issues
    .filter((i) => i.fields.issuetype.name === "Sub-task")
    .map((i) => {
      return {
        issue_id: i.id,
        issue_type: i.fields.issuetype.name,
        story_id: i.fields.parent.id,
        status_category_name: i.fields.status.statusCategory.name,
        issue_name: i.fields.summary,
      };
    });
  for (let subtask of sub_tasks) {
    const key = subtask.story_id + subtask.status_category_name;
    if (!status_category_map[key]) {
      status_category_map[key] = {
        story_id: subtask.story_id,
        status_category_name: subtask.status_category_name,
        issue_count: 1,
      };
    } else {
      status_category_map[key].issue_count++;
    }
  }
  let values = Object.values(status_category_map);
  values = values.map((v) => {
    return {
      story_id: v.story_id,
      status_category_name: v.status_category_name,
      issue_count: v.issue_count.toString(),
      unique_id: v.story_id + v.status_category_name,
    };
  });
  res.json({
    values,
  });
});

app.get("/:boardID/activeSprint/members", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getSprints(board_id);
  let sprint_id = "";
  let active_sprint = data.values.filter((sprint) => sprint.state === "active");
  if (active_sprint.length === 0) {
    const active_sprint = data.values.filter(
      (sprint) => sprint.state === "closed"
    );
    active_sprint = active_sprint[active_sprint.length - 1][0];
  } else {
    active_sprint = active_sprint[0];
  }
  sprint_id = active_sprint.id.toString();
  const sprint_issues = await getSprintIssues(sprint_id);
  const issues = sprint_issues.issues;
  let names = new Set();
  let members = [];
  for (let issue of issues) {
    if (issue.fields.issuetype.name !== "Story") {
      if (issue.fields.assignee) {
        let name = issue.fields.assignee.displayName;
        if (!names.has(name)) {
          let member = {
            board_id,
            sprint_id,
            sprint_member_account_id:
              issue.fields.assignee.accountId.toString(),
            sprint_member_full_name: issue.fields.assignee.displayName,
            sprint_member_card_name: issue.fields.assignee.displayName
              .substring(0, 2)
              .toUpperCase(),
          };
          members.push(member);
          names.add(name);
        }
      }
    }
  }
  res.json({
    members,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});
