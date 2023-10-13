const express = require("express");
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
  const data = await getSprintIssues(sprint_id);
  const issues = data.issues
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
    issues,
  });
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
          sprint_id: issue.fields.sprint.id,
          story_points: 0,
        };
      }
    } else {
      if (issue.fields.parent) {
        const parent_id = issue.fields.parent.id;
        const child_id = issue.id;
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});
