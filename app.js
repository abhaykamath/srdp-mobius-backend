const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const getSprints = require("./APIs/get-all-sprints-for-a-board");
const getSprintIssues = require("./APIs/get-all-issues-for-a-sprint");
const getBoardIssues = require("./APIs/get-all-issues-for-a-board");
const getComments = require("./APIs/comments");
const getAlerts = require("./APIs/getalerts");
const { isToday } = require("./APIs/utils");

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

// ALerts
app.get("/alerts", async (req, res) => {
  const data = await getAlerts();
  console.log(data, "data");
  const issues = data.issues;
  const alerts_data = issues
    .filter((issue) => issue.fields.issuetype.name === "Story")
    .map((issue) => {
      if (issue.fields.customfield_10018 && issue !== null) {
        return {
          creator: issue.fields.creator.displayName,
          assignee:
            issue.fields.assignee !== null
              ? issue.fields.assignee.displayName
              : "Not added",
          sprint_id: issue.fields.customfield_10018[0].id.toString(),
          sprint_name: issue.fields.customfield_10018[0].name,
          sprint_start: issue.fields.customfield_10018[0].startDate
            ? issue.fields.customfield_10018[0].startDate.substring(0, 10)
            : "",
          sprint_end: issue.fields.customfield_10018[0].endDate
            ? issue.fields.customfield_10018[0].endDate.substring(0, 10)
            : "",
          story_id: issue.id,
          story_name: issue.fields.summary,
          story_type: issue.fields.issuetype.name,
          story_status: issue.fields.status.statusCategory.name,
          project_id: issue.fields.project.id,
          project_name: issue.fields.project.name,
          status_name: issue.fields.status.name,
          story_points:
            issue.fields.customfield_10020 == null
              ? 0
              : issue.fields.customfield_10020,
          story_ac_hygiene: issue.fields.customfield_10157 ? "YES" : "NO",
          story_reviewers: issue.fields.customfield_10003
            ? issue.fields.customfield_10003.length !== 0
              ? issue.fields.customfield_10003
                  .map((r, i) => r.displayName)
                  .join(", ")
              : "Reviewers not added"
            : "Reviewers not added",
          // updated: new Date(issue.fields.updated).getTime(),
          updated: issue.fields.updated,
        };
      }
    });
  // console.log(alerts_data);
  res.json(alerts_data);
});

app.get("/comments", async (req, res) => {
  const body = req.params.body;
  const issues = await getComments(body);
  // const issues = data.issues || [];
  console.log("no of issues: " + issues.length);
  const issuesHavingStatusComments = issues.filter((issue) => {
    const comments =
      (issue.fields.comment && issue.fields.comment.comments) || [];
    const dayComments = comments.filter((c) => isToday(c.updated));
    const commentsHavingUpdate = dayComments.filter((c) => {
      const hasUpdate = c.body.trim().startsWith("[#STATUS_UPDATE#]:");
      if (hasUpdate) c.body = c.body.substring(19).trim();
      return hasUpdate;
    });
    const havingUpdates = commentsHavingUpdate.length > 0;
    issue.statusUpdates = commentsHavingUpdate;
    return havingUpdates;
  });
  // let all_comments = data;
  res.json(issuesHavingStatusComments);
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
        story_points:
          issue.fields.customfield_10020 == null
            ? 0
            : issue.fields.customfield_10020,
        updated: issue.fields.updated,
        creator: issue.fields.creator.displayName,
        assignee:
          issue.fields.assignee !== null
            ? issue.fields.assignee.displayName
            : "Not added",
        duedate:
          issue.fields.duedate == null ? "Not added" : issue.fields.duedate,
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
          story_status: issue.fields.status.name,
          assignee : issue.fields.assignee !== null
          ? issue.fields.assignee.displayName
          : "Not added",
        };
        // console.log("story_subtask_map", story_subtask_map);
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
        assignee :  i.fields.assignee?i.fields.assignee.displayName : "Not added" ,
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
        assignee :subtask.assignee,
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

// This API is to fetch all the stories
// for a specific board
app.get("/:boardId/sprints", async (req, res) => {
  const board_id = req.params.boardId;
  const data = await getSprints(board_id);
  let sprints = data.values;
  sprints = sprints.map((sprint) => {
    if (sprint.state !== "future")
      return {
        board_id: sprint.originBoardId.toString(),
        sprint_id: sprint.id.toString(),
        sprint_name: sprint.name,
        sprint_start: sprint.startDate.substring(0, 10),
        sprint_end: sprint.endDate.substring(0, 10),
        spint_state: sprint.state,
      };
  });
  // Getting rid of null values
  sprints = sprints.filter((sprint) => {
    if (sprint) return sprint;
  });
  res.json(sprints);
});

app.get("/:boardID/stories", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const issues = data.issues;
  const stories = issues
    .filter((issue) => issue.fields.issuetype.name === "Story")
    .map((issue) => {
      if (issue.fields.customfield_10018) {
        return {
          board_id,
          sprint_id: issue.fields.customfield_10018[0].id.toString(),
          sprint_name: issue.fields.customfield_10018[0].name,
          sprint_start: issue.fields.customfield_10018[0].startDate
            ? issue.fields.customfield_10018[0].startDate.substring(0, 10)
            : "",
          sprint_end: issue.fields.customfield_10018[0].endDate
            ? issue.fields.customfield_10018[0].endDate.substring(0, 10)
            : "",
          story_id: issue.id,
          story_name: issue.fields.summary,
          story_type: issue.fields.issuetype.name,
          story_status: issue.fields.status.statusCategory.name,
          project_id: issue.fields.project.id,
          project_name: issue.fields.project.name,
          status_name: issue.fields.status.name,
          story_ac_hygiene: issue.fields.customfield_10157 ? "YES" : "NO",
          original_estimate:
            issue.fields.timetracking.originalEstimate || "Not added",
          remaining_estimate:
            issue.fields.timetracking.remainingEstimate || "Not added",
          time_spent: issue.fields.timetracking.timeSpent || "Not added",
          assignee : issue.fields.assignee !== null
          ? issue.fields.assignee.displayName
          : "Not added",
          story_reviewers: issue.fields.customfield_10003
            ? issue.fields.customfield_10003.length !== 0
              ? issue.fields.customfield_10003
                  .map((r, i) => r.displayName)
                  .join(", ")
              : "Reviewers not added"
            : "Reviewers not added",
        };
      }
    });
  res.json({
    stories,
  });
});
// for understanding
// if variable==100 ? 100 < x ? 10 : null : not
// {{[{},{}],[]}}

// This API is to fetch all sprint progress
// for a specific board
app.get("/:boardID/sprint/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const issues = data.issues;
  const story_subtask_map = {};
  for (let issue of issues) {
    if (issue.fields.issuetype.name === "Story") {
      if (!story_subtask_map[issue.id]) {
        if (issue.fields.customfield_10018) {
          story_subtask_map[issue.id] = {
            number_of_sub_tasks: 0,
            completed_sub_tasks: 0,
            story_id: issue.id,
            story_name: issue.fields.summary,
            project_id: issue.fields.project.id,
            sprint_id: issue.fields.customfield_10018[0].id.toString(),
            story_points: 0,
            board_id,
            story_status: issue.fields.status.statusCategory.name,
            assignee : issue.fields.assignee !== null
            ? issue.fields.assignee.displayName
            : "Not added",
          };
        }
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
      story_status: v.story_status,
      assignee : v.assignee,
    };
  });
  res.json({
    sprint_progress: values,
  });
});

// This API is to fetch all story progress
// for a specific board
app.get("/:boardID/sprint/story/progress", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
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
        assignee : i.fields.assignee !== null
        ? i.fields.assignee.displayName
        : "Not added",
      };
    });
  for (let subtask of sub_tasks) {
    const key = subtask.story_id + subtask.status_category_name;
    if (!status_category_map[key]) {
      status_category_map[key] = {
        story_id: subtask.story_id,
        status_category_name: subtask.status_category_name,
        issue_count: 1,
        assignee : subtask.assignee,
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
      assignee : v.assignee,
      unique_id: v.story_id + v.status_category_name,
    };
  });

  res.json({
    values,
  });
});

// This API is to fetch all sprint members
// for a specific board
app.get("/:boardID/sprint/members", async (req, res) => {
  const board_id = req.params.boardID;
  const data = await getBoardIssues(board_id);
  const issues = data.issues;
  let names = new Set();
  let members = [];
  for (let issue of issues) {
    if (issue.fields.issuetype.name !== "Story") {
      if (issue.fields.assignee) {
        if (issue.fields.customfield_10018) {
          let name =
            issue.fields.assignee.displayName +
            issue.fields.customfield_10018[0].id.toString();
          if (!names.has(name)) {
            let member = {
              board_id,
              sprint_id: issue.fields.customfield_10018[0].id.toString(),
              sprint_member_account_id:
                issue.fields.assignee.accountId.toString(),
              sprint_member_full_name: issue.fields.assignee.displayName,
              sprint_member_card_name: issue.fields.assignee.displayName
                .substring(0, 2)
                .toUpperCase(),
              unique_id:
                issue.fields.customfield_10018[0].id.toString() +
                issue.fields.assignee.displayName,
                 assignee : issue.fields.assignee !== null
            ? issue.fields.assignee.displayName
            : "Not added",
            };
            members.push(member);
            names.add(name);
            console.log(names);
          }
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





