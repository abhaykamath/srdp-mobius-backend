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
  res.json({
    active_sprint: active_sprint.length === 1 ? active_sprint[0] : null,
  });
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
        };
      }
    } else {
      const parent_id = issue.fields.parent.id;
      const child_id = issue.id;
      story_subtask_map[parent_id].number_of_sub_tasks++;
      if (issue.fields.status.name === "Done") {
        story_subtask_map[parent_id].completed_sub_tasks++;
      }
    }
  }
  const values = Object.values(story_subtask_map);
  res.json({
    sprint_progress: values,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});
